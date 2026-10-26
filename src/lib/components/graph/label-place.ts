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
	taken: readonly Rect[] | Taken,
	always = false,
	/** The height of the canvas: a name below the lowest bron is not cut off at its foot. */
	height = Infinity
): { x: number; y: number } | null {
	const side = { x: labelX(x, size, w, room), y: y - h / 2 };
	const mid = Math.min(Math.max(EDGE, x - w / 2), Math.max(EDGE, room - w - EDGE));
	const hits = (r: Rect) =>
		taken instanceof Taken ? taken.hits(r) : taken.some((t) => overlaps(r, t));
	const candidates = [
		side,
		{ x: x - size - GAP - w, y: y - h / 2 },
		{ x: mid, y: y - size - GAP - h },
		{ x: mid, y: y + size + GAP }
	].filter(
		(c) => c.x >= EDGE && c.x + w <= room - EDGE + 0.5 && c.y >= EDGE && c.y + h <= height - EDGE
	);
	const free = candidates.find((c) => !hits({ ...c, w, h }));
	return free ?? (always ? side : null);
}

/** The places taken in a frame, by the cells of a grid: a few thousand bronnen stay quick. */
class Taken {
	private readonly cells = new Map<string, Rect[]>();
	constructor(
		rects: Iterable<Rect> = [],
		private readonly cel = 48
	) {
		for (const r of rects) this.add(r);
	}
	private *keysOf(r: Rect) {
		for (let i = Math.floor(r.x / this.cel); i <= Math.floor((r.x + r.w) / this.cel); i++)
			for (let j = Math.floor(r.y / this.cel); j <= Math.floor((r.y + r.h) / this.cel); j++)
				yield `${i},${j}`;
	}
	add(r: Rect): void {
		for (const k of this.keysOf(r)) {
			const cel = this.cells.get(k);
			if (cel) cel.push(r);
			else this.cells.set(k, [r]);
		}
	}
	hits(r: Rect): boolean {
		for (const k of this.keysOf(r)) if (this.cells.get(k)?.some((t) => overlaps(r, t))) return true;
		return false;
	}
}

/** Past this many names in a frame, a bron of lower rank waits for a hover (UX review N4). */
export const NAMES_PER_FRAME = 60;

/** A bron whose name the frame may draw: where it stands, its name's size, and its rank. */
export type LabelCandidate = {
	id: string;
	x: number;
	y: number;
	size: number;
	w: number;
	h: number;
	/** Higher goes first: the focus, the chosen bronnen, a cluster, the bronnen in the hover. */
	rank: number;
	/** Drawn whatever stands there (the focus). */
	always?: boolean;
};

/**
 * Where the names of a frame stand, the highest rank first (then the larger bron): beside
 * their bron, clear of the names already placed, of `vast` (the hulls' names) and of the signs
 * of the bronnen (`glyphs`), inside the canvas (`room`). Past `max` names only those `altijd`
 * are placed: a busy canvas names what matters most, without names over one another or over
 * the bronnen (UX review N4: BH2815 and its 137 uitspraken).
 */
export function planLabels(
	candidates: readonly LabelCandidate[],
	room: { width: number; height: number },
	vast: readonly Rect[],
	glyphs: readonly Rect[],
	max = NAMES_PER_FRAME
): Map<string, Rect> {
	const occupied = new Taken([...vast, ...glyphs]);
	const plan = new Map<string, Rect>();
	const order = [...candidates].sort(
		(a, b) => Number(!!b.always) - Number(!!a.always) || b.rank - a.rank || b.size - a.size
	);
	for (const k of order) {
		if (!k.always && plan.size >= max) break;
		// The places beside its own sign keep clear of it (GAP).
		const at = plaatsLabel(k.x, k.y, k.size, k.w, k.h, room.width, occupied, k.always, room.height);
		if (!at) continue;
		const r = { x: at.x, y: at.y, w: k.w, h: k.h };
		occupied.add(r);
		plan.set(k.id, r);
	}
	return plan;
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
