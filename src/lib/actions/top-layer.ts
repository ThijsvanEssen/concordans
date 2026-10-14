// A menu or a card in the top layer (the popover API), so that no column that scrolls on its
// own cuts it off: fixed by its anchor, below it, or above it where the window ends below and
// there is more room above, at the anchor's left edge or (`align: 'right'`) its right, and
// never past a side of the window. It follows a scroll and a resize, and is placed again when
// it grows (a card whose text comes). Its height is capped at the room it has, as `--room`: a
// style reads `max-height: var(--room)`, or less where it wants less.
//
// `clickOutside` is the one way such a thing closes on a click or tap elsewhere: in the
// capture phase, so it closes before what was hit reacts, and the click is only watched.
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
export type Align = 'left' | 'right';

/**
 * Where a box goes by its anchor: `up` when it does not fit below and there is more room above,
 * the `room` it may take on that side, and its `left`, inside the window.
 */
export function placement(
	anchor: Edges,
	box: Size,
	view: Size,
	align: Align = 'left'
): { up: boolean; room: number; left: number } {
	const below = view.height - anchor.bottom - GAP - EDGE;
	const above = anchor.top - GAP - EDGE;
	const up = box.height > below && above > below;
	const start = align === 'right' ? anchor.right - box.width : anchor.left;
	return {
		up,
		room: Math.max(MIN_ROOM, up ? above : below),
		left: Math.max(EDGE, Math.min(start, view.width - box.width - EDGE))
	};
}

/** The top of a box of `height` shown below its anchor, or above it. */
export const topOf = (anchor: Edges, up: boolean, height: number): number =>
	up ? anchor.top - GAP - height : anchor.bottom + GAP;

const popover = (el: HTMLElement) => typeof el.showPopover === 'function';

export type TopLayer = {
	/** What the box hangs from. */
	anchor: HTMLElement;
	align?: Align;
	/** Moved to the end of the body first: out of a text whose style it would inherit. */
	detach?: boolean;
};

export const topLayer: Action<HTMLElement, TopLayer> = (el, params) => {
	let { anchor, align = 'left' } = params;
	if (params.detach) document.body.appendChild(el);
	if (popover(el)) {
		if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
		if (!el.matches(':popover-open')) el.showPopover();
	}

	const place = () => {
		const a = anchor.getBoundingClientRect();
		// Its whole height, borders too, however much of it its cap now shows.
		const height = el.scrollHeight + el.offsetHeight - el.clientHeight;
		const view = { width: innerWidth, height: innerHeight };
		const { up, room, left } = placement(a, { width: el.offsetWidth, height }, view, align);
		el.style.setProperty('--room', `${Math.round(room)}px`);
		el.style.top = `${Math.round(topOf(a, up, el.offsetHeight))}px`;
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
			({ anchor, align = 'left' } = next);
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
 * in the capture phase. Returns the function that stops watching.
 */
export function clickOutside(
	inside: () => (Node | null | undefined)[],
	onOutside: () => void
): () => void {
	const watch = (e: Event) => {
		const t = e.target;
		if (!(t instanceof Node) || inside().some((n) => n?.contains(t))) return;
		onOutside();
	};
	document.addEventListener('click', watch, true);
	return () => document.removeEventListener('click', watch, true);
}
