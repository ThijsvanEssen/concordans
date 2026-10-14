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

export type Rect = { x: number; y: number; w: number; h: number };

export const overlaps = (a: Rect, b: Rect) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Where a name of `w` × `h` stands beside a bron at (`x`, `y`) without covering a name already
 * drawn (`taken`): right, left, above or below the bron. Null where no place is free; the name
 * then waits for a hover. `always` (the focus) takes its place beside the bron regardless. The
 * place returned is the top left of the name.
 */
export function plaatsLabel(
	x: number,
	y: number,
	size: number,
	w: number,
	h: number,
	room: number,
	taken: readonly Rect[],
	always = false
): { x: number; y: number } | null {
	const side = { x: labelX(x, size, w, room), y: y - h / 2 };
	const mid = Math.min(Math.max(EDGE, x - w / 2), Math.max(EDGE, room - w - EDGE));
	const candidates = [
		side,
		{ x: x - size - GAP - w, y: y - h / 2 },
		{ x: mid, y: y - size - GAP - h },
		{ x: mid, y: y + size + GAP }
	].filter((c) => c.x >= EDGE && c.x + w <= room - EDGE + 0.5);
	const free = candidates.find((c) => !taken.some((t) => overlaps({ ...c, w, h }, t)));
	return free ?? (always ? side : null);
}

/**
 * Where a hovered bron's name stands when it has no place of its own yet: beside the bron, on
 * the side that keeps it inside the canvas (`room`) and clear of a card over it (`avoid`),
 * else as far in as the canvas lets it. The top left of the name.
 */
export function hoverPlaats(
	x: number,
	y: number,
	size: number,
	w: number,
	h: number,
	room: number,
	avoid: Rect | null = null
): { x: number; y: number } {
	const top = y - h / 2;
	const vrij = (lx: number) =>
		lx >= EDGE && lx + w <= room - EDGE && !(avoid && overlaps({ x: lx, y: top, w, h }, avoid));
	const right = x + size + GAP;
	const left = x - size - GAP - w;
	if (vrij(right)) return { x: right, y: top };
	if (vrij(left)) return { x: left, y: top };
	const binnen = avoid && right + w > avoid.x ? avoid.x - w - EDGE : room - w - EDGE;
	return { x: Math.max(EDGE, Math.min(right, binnen)), y: top };
}

/**
 * Where a verbinding's name stands: level, at the middle of its line, inside the canvas. The
 * top left of the name (Thijs, 10 Oct: one rule for every line, level text reads easier).
 */
export function lijnLabelPlaats(
	sx: number,
	sy: number,
	tx: number,
	ty: number,
	w: number,
	h: number,
	room: number
): { x: number; y: number } {
	const mx = (sx + tx) / 2;
	const my = (sy + ty) / 2;
	return { x: Math.max(EDGE, Math.min(mx - w / 2, room - w - EDGE)), y: my - h / 2 };
}
