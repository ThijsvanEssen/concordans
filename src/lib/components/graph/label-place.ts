// Where a bron's name stands on the canvas: right of the bron, left of it where the right
// would run past the edge, and where neither side has room, as far right as the canvas lets
// it, over the bron if need be ("Motie, Kamerstuk 36799, nr. 31" in a column of 320 px).

/** Margin between a name and the edge of the canvas. */
const EDGE = 2;
/** Gap between a bron and its name. */
const GAP = 3;

/** The x of the left end of a name of width `w` beside a bron at `x` of radius `size`. */
export function labelX(x: number, size: number, w: number, room: number): number {
	const right = x + size + GAP;
	if (right + w + EDGE <= room) return right;
	const left = x - size - GAP - w;
	if (left >= EDGE) return left;
	return Math.max(EDGE, room - w - EDGE);
}
