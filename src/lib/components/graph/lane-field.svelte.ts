// The field of the lanes follows what is marked, open or pointed at: the drawing makes room for
// the card over it, scrolls to what is chosen with the units its lines reach, and the bron the
// keyboard's list is on comes into view with its name beside it (R9; the ring is drawn by the units,
// `.is-pointed`). A card closed with its × gives the focus back to what opened it.
import { cardWidth, chosenOn, showBeside, showPointed } from '$lib/graph/lane-changes';
import { afterTick } from '$lib/util/after-tick';

type Tip = { x: number; y: number; text: string };

type Read = () => {
	field: HTMLElement | null;
	/** What redraws the lanes: the width, the scale, the nodes. */
	redraw: unknown[];
	/** A card is open: a unit marked or a group's Zijpaneel. */
	open: boolean;
	/** The unit the card stands for, and the units its lines reach. */
	unit: string | null;
	linked: (id: string) => string[];
	pointed: string | null;
};

export function laneField(read: Read, setCovered: (width: number) => void) {
	let hover = $state<Tip | null>(null);
	let key = $state<Tip | null>(null);
	// The card lies over the field (Thijs, 1 nov.): the drawing shrinks as far as it may.
	$effect(() => {
		const { field, open, redraw } = read();
		void redraw;
		if (!open || !field) return setCovered(0);
		const frame = requestAnimationFrame(() => setCovered(cardWidth(field)));
		return () => cancelAnimationFrame(frame);
	});
	$effect(() => {
		const { field, unit, linked, redraw } = read();
		void redraw;
		if (!unit || !field) return;
		const frame = requestAnimationFrame(() => showBeside(field, unit, linked(unit)));
		return () => cancelAnimationFrame(frame);
	});
	$effect(() => {
		const { field, pointed, redraw } = read();
		void redraw;
		if (!pointed || !field) {
			key = null;
			return;
		}
		const frame = requestAnimationFrame(() => {
			showPointed(field);
			const el = field.querySelector<SVGElement>('.member.is-pointed[data-name]');
			key = el
				? { x: Number(el.dataset.x), y: Number(el.dataset.y), text: el.dataset.name ?? '' }
				: null;
		});
		return () => cancelAnimationFrame(frame);
	});
	$effect(() => {
		const { field, unit } = read();
		const chosen = unit && field ? chosenOn(field, unit) : null;
		return () => {
			afterTick(() => {
				if (chosen?.isConnected && document.activeElement === document.body)
					chosen.focus({ preventScroll: true });
			});
		};
	});
	return {
		get tip() {
			return hover ?? key;
		},
		show: (t: Tip) => (hover = t),
		hide: () => (hover = null)
	};
}
