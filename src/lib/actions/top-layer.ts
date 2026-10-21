// A menu or a card in the top layer (the popover API), so that no column that scrolls on its
// own cuts it off: fixed by its anchor, below it, or above it where the window ends below and
// there is more room above, at the anchor's left edge or (`align: 'right'`) its right, and
// never past a side of the window. It follows a scroll and a resize, and is placed again when
// it grows (a card whose text comes). It closes once its anchor scrolls out of what shows of
// the column it scrolls in (or of the window): followed there it would lie over the TopBar
// (#96). Its height is capped at the room it has, as `--room`: a
// style reads `max-height: var(--room)`, or less where it wants less.
//
// `clickOutside` is the one way such a thing closes on a click or tap elsewhere: in the
// capture phase, so it closes before what was hit reacts; that click only closes, it opens
// nothing under it (#98). It watches while the box is open only.
import type { Action } from 'svelte/action';

/** Between the anchor and the box. */
export const GAP = 4;
/** Between the box and the window's edge. */
export const EDGE = 8;
/** The least height a box gets, however little room the window leaves. */
export const MIN_ROOM = 160;
/** How long the pointer rests on a link or a formula before its card shows. */
export const HOVER_MS = 350;
/** The moment a pointer has to cross from a link to its card, or back. */
export const LEAVE_MS = 250;

type Edges = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>;
type Size = { width: number; height: number };
type Align = 'left' | 'right';

/**
 * Where a box goes by its anchor: `up` when it does not fit below and there is more room above,
 * the `room` it may take on that side, and its `left`, inside the window.
 */
export function placement(
	anchor: Edges,
	box: Size,
	view: Size,
	align: Align = 'left',
	downOnly = false,
	gap = GAP
): { up: boolean; room: number; left: number } {
	const below = view.height - anchor.bottom - gap - EDGE;
	const above = anchor.top - GAP - EDGE;
	const up = !downOnly && box.height > below && above > below;
	const start = align === 'right' ? anchor.right - box.width : anchor.left;
	return {
		up,
		room: Math.max(MIN_ROOM, up ? above : below),
		left: Math.max(EDGE, Math.min(start, view.width - box.width - EDGE))
	};
}

/** The top of a box of `height` shown below its anchor, or above it. */
export const topOf = (anchor: Edges, up: boolean, height: number, gap = GAP): number =>
	up ? anchor.top - GAP - height : anchor.bottom + gap;

/** The room the phone's own bar takes under words selected (`--systeembalk`), in pixels. */
const systemBar = () =>
	parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--systeembalk')) || GAP;

/**
 * Whether an anchor is out of what shows of the boxes that clip it (its scrolling columns and
 * the window): its middle past an edge of one of them. Half under an edge still shows it.
 */
export function outOfView(anchor: Edges, views: Edges[]): boolean {
	const y = (anchor.top + anchor.bottom) / 2;
	const x = (anchor.left + anchor.right) / 2;
	return views.some((v) => y < v.top || y > v.bottom || x < v.left || x > v.right);
}

const CLIPS = /auto|scroll|hidden|clip/;

/** The elements around `el` that clip what overflows them: the columns it scrolls in. */
function clippers(el: HTMLElement): HTMLElement[] {
	const found: HTMLElement[] = [];
	for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
		const { overflowX, overflowY } = getComputedStyle(p);
		if (CLIPS.test(overflowX) || CLIPS.test(overflowY)) found.push(p);
	}
	return found;
}

const popover = (el: HTMLElement) => typeof el.showPopover === 'function';

type TopLayer = {
	/** What the box hangs from. */
	anchor: HTMLElement;
	/** Closes the box: its anchor has scrolled out of view. */
	close: () => void;
	align?: Align;
	/** Moved to the end of the body first: out of a text whose style it would inherit. */
	detach?: boolean;
	/** Where it hangs from, where not the anchor's box: the words a reader selected. */
	rect?: (() => Edges) | null;
	/** Words selected on a phone: below them always, past the phone's own bar under them. */
	below?: boolean;
};

export const topLayer: Action<HTMLElement, TopLayer> = (el, params) => {
	let { anchor, close, align = 'left', rect = null, below = false } = params;
	let around = clippers(anchor);
	if (params.detach) document.body.appendChild(el);
	if (popover(el)) {
		if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
		if (!el.matches(':popover-open')) el.showPopover();
	}

	const place = () => {
		const a = rect ? rect() : anchor.getBoundingClientRect();
		const view = { width: innerWidth, height: innerHeight };
		const shown = { top: 0, left: 0, bottom: view.height, right: view.width };
		if (outOfView(a, [shown, ...around.map((c) => c.getBoundingClientRect())])) return close();
		// Its whole height, borders too, however much of it its cap now shows.
		const height = el.scrollHeight + el.offsetHeight - el.clientHeight;
		const gap = below ? systemBar() : GAP;
		const box = { width: el.offsetWidth, height };
		const { up, room, left } = placement(a, box, view, align, below, gap);
		el.style.setProperty('--room', `${Math.round(room)}px`);
		el.style.top = `${Math.round(topOf(a, up, el.offsetHeight, gap))}px`;
		el.style.left = `${Math.round(left)}px`;
	};

	place();
	// After the frame: a place set inside the observer's own callback would be seen again.
	let frame = 0;
	const grows = new ResizeObserver(() => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(place);
	});
	grows.observe(el);
	addEventListener('scroll', place, { capture: true, passive: true });
	addEventListener('resize', place);

	return {
		update(next) {
			({ anchor, close, align = 'left', rect = null, below = false } = next);
			around = clippers(anchor);
			place();
		},
		destroy() {
			cancelAnimationFrame(frame);
			grows.disconnect();
			removeEventListener('scroll', place, { capture: true });
			removeEventListener('resize', place);
			if (popover(el) && el.matches(':popover-open')) el.hidePopover();
			if (params.detach) el.remove();
		}
	};
};

/**
 * Calls `onOutside` on a click or tap outside everything `inside` gives (the box, its anchor),
 * in the capture phase; that click goes no further. Returns the function that stops watching.
 */
export function clickOutside(
	inside: () => (Node | null | undefined)[],
	onOutside: () => void
): () => void {
	const watch = (e: Event) => {
		const t = e.target;
		if (!(t instanceof Node) || inside().some((n) => n?.contains(t))) return;
		e.stopPropagation();
		e.preventDefault();
		onOutside();
	};
	document.addEventListener('click', watch, true);
	return () => document.removeEventListener('click', watch, true);
}
