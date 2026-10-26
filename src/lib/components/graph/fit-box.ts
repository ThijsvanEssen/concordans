// The box of the graph a fit frames (GraphCanvas `fit`): the bronnen, grown on each side by
// the share of the canvas that side keeps free. Above, a hull's name pill; below, a bron's
// name under the lowest bron; at the side, the zoom over the canvas (UX review N8: after a
// fit the focus stood on the lower edge and Art. 5:20 BW was cut off at the foot).

export type Insets = { top: number; right: number; bottom: number; left: number };
type Box = { x: [number, number]; y: [number, number] };

/** A bron's name below the lowest bron: its height (13 px and 4 of paper) and its gap. */
export const NAME_BELOW = 24;

/**
 * The graph box from the bronnen's `min` to `max` (graph y points up) that leaves `inzet` px
 * free on each side of a canvas of `dims`, inside sigma's own `padding`. A side is grown by
 * the share of the usable length its pixels take; an axis too short to hold them is not grown.
 */
export function fitBox(
	min: { x: number; y: number },
	max: { x: number; y: number },
	dims: { width: number; height: number },
	padding: number,
	insets: Insets
): Box {
	const grow = (lo: number, hi: number, usable: number, before: number, after: number) => {
		const span = hi - lo || 1;
		const rest = usable - before - after;
		if (rest < (before + after) * 2) return [lo, lo + span] as [number, number];
		return [lo - (span * before) / rest, lo + span + (span * after) / rest] as [number, number];
	};
	return {
		x: grow(min.x, max.x, dims.width - 2 * padding, insets.left, insets.right),
		// Graph y points up: the bottom of the screen is the low end.
		y: grow(min.y, max.y, dims.height - 2 * padding, insets.bottom, insets.top)
	};
}

/**
 * The px an element over the canvas keeps free at its side (`over`, both in the page's px): a
 * column (the zoom) at the left or the right, a bar at the top or the foot. Nothing for an
 * element not shown or not over it.
 */
export function insetsOf(canvas: DOMRectReadOnly, over: readonly DOMRectReadOnly[]): Insets {
	const insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
	for (const r of over) {
		if (r.width === 0 || r.height === 0) continue;
		if (r.right <= canvas.left || r.left >= canvas.right) continue;
		if (r.bottom <= canvas.top || r.top >= canvas.bottom) continue;
		const midX = (r.left + r.right) / 2 - canvas.left;
		const midY = (r.top + r.bottom) / 2 - canvas.top;
		if (r.height >= r.width) {
			if (midX > canvas.width / 2) insets.right = Math.max(insets.right, canvas.right - r.left);
			else insets.left = Math.max(insets.left, r.right - canvas.left);
		} else if (midY > canvas.height / 2) {
			insets.bottom = Math.max(insets.bottom, canvas.bottom - r.top);
		} else {
			insets.top = Math.max(insets.top, r.bottom - canvas.top);
		}
	}
	return insets;
}
