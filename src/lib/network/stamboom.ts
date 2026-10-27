// The lines of the keten as a stamboom (besluit 39, A306): from the bron one stem down; per
// layer one tak, in the rail above the layer; from it a short line down to each node. A line
// to a layer further down keeps to the stem where it can, and runs beside a name where it
// cannot, so nothing runs through a name. Every bend is a bezier, as the canvas and Verband
// bend their lines (line-shape.ts): the stem and a tak run into each other in a wide arc, a tak
// eases off to its node. Pure: ChainView draws what this returns.

export type Pt = { x: number; y: number };
/** Where a node stands: its column, its layer, where a line ends above it and leaves under its name. */
export type StamNode = { x: number; row: number; top: number; bottom: number };
export type StamEdge = { id: string; parent: string; child: string; kind: string; lead?: number };
export type Box = { id: string; x0: number; x1: number; y0: number; y1: number };
export type StamLine = {
	id: string;
	parent: string;
	child: string;
	kind: string;
	/** The bezier path, from under the parent's name to above the child's sign. */
	d: string;
	/** The skeleton of the path: where it runs before its bends are eased. */
	points: Pt[];
	/** Where the line leaves the parent (the arrowhead's tip), and where it ends above the child. */
	tip: Pt;
	end: Pt;
};

/** How far a bend reaches along a tak, and down a stem or drop, at most. */
export const REACH = 44;
export const DIP = 28;
/** A tak lies this far above the one below it, where two of one layer would run into each other. */
export const LEVEL = 4;
const MAX_LEVEL = 2;
/** The room kept between a line and a name. */
const MARGIN = 4;
/** Drops into one child stand this far apart. */
const SPREAD = 4;

const r1 = (n: number) => Math.round(n * 10) / 10;
const len = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** The skeleton without repeated points or points in a straight line. */
function tidy(pts: Pt[]): Pt[] {
	const out: Pt[] = [];
	for (const p of pts) {
		if (out.length && len(out[out.length - 1], p) < 0.01) continue;
		const n = out.length;
		if (n > 1) {
			const a = out[n - 2];
			const b = out[n - 1];
			if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) out.pop();
		}
		out.push(p);
	}
	return out;
}

const toward = (from: Pt, to: Pt, d: number): Pt => {
	const l = len(from, to) || 1;
	return { x: from.x + ((to.x - from.x) * d) / l, y: from.y + ((to.y - from.y) * d) / l };
};

/**
 * The bezier along a skeleton of vertical and horizontal runs: each bend is a quadratic curve
 * with the bend itself as control point, as wide as the runs on either side allow. A short
 * step sideways between two vertical runs is one S of a cubic.
 */
export function easePath(pts: Pt[]): string {
	const n = pts.length;
	if (n < 2) return '';
	const room = (a: number, b: number, last: boolean, first: boolean) =>
		len(pts[a], pts[b]) * (first || last ? 0.8 : 0.5);
	let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
	let i = 1;
	while (i < n - 1) {
		const here = pts[i];
		const vertIn = pts[i - 1].x === here.x;
		const next = pts[i + 1];
		const step = len(here, next);
		if (!vertIn || next.y !== here.y || step >= 2 * 12 || i + 2 >= n) {
			const cap = vertIn ? DIP : REACH;
			const capOut = vertIn ? REACH : DIP;
			const din = Math.min(cap, room(i - 1, i, false, i === 1));
			const dout = Math.min(capOut, room(i, i + 1, false, i + 1 === n - 1));
			const a = toward(here, pts[i - 1], din);
			const b = toward(here, next, dout);
			d += `L${r1(a.x)} ${r1(a.y)}Q${r1(here.x)} ${r1(here.y)} ${r1(b.x)} ${r1(b.y)}`;
			i++;
			continue;
		}
		// A step of a few px between two runs down: one S.
		const sy = Math.sign(here.y - pts[i - 1].y) || 1;
		const da = Math.min(DIP, room(i - 1, i, false, i === 1));
		const db = Math.min(DIP, room(i + 1, i + 2, false, i + 2 === n - 1));
		const a = { x: here.x, y: here.y - sy * da };
		const b = { x: next.x, y: next.y + sy * db };
		const m = (a.y + b.y) / 2;
		d += `L${r1(a.x)} ${r1(a.y)}C${r1(a.x)} ${r1(m)} ${r1(b.x)} ${r1(m)} ${r1(b.x)} ${r1(b.y)}`;
		i += 2;
	}
	const last = pts[n - 1];
	return `${d}L${r1(last.x)} ${r1(last.y)}`;
}

type Group = {
	key: string;
	parent: StamNode;
	row: number;
	x0: number;
	x1: number;
	level: number;
	column: number;
	edges: StamEdge[];
};

/** A column beside the parent's own where nothing of the layers between stands, nearest first. */
function freeColumn(
	x: number,
	from: number,
	to: number,
	boxes: readonly Box[],
	skip: Set<string>,
	spans: readonly { x0: number; x1: number }[]
) {
	const hits = (c: number) =>
		spans.some((t) => c > t.x0 - MARGIN && c < t.x1 + MARGIN) ||
		boxes.some(
			(b) =>
				!skip.has(b.id) && b.y1 >= from && b.y0 <= to && c >= b.x0 - MARGIN && c <= b.x1 + MARGIN
		);
	for (let k = 0; k <= 80; k++)
		for (const c of k ? [x + 6 * k, x - 6 * k] : [x]) if (!hits(c)) return c;
	return x;
}

/** The groups of lines that share a stem and a tak: one parent, one layer, one kind. */
function groups(nodes: ReadonlyMap<string, StamNode>, edges: readonly StamEdge[]): Group[] {
	const out = new Map<string, Group>();
	for (const e of edges) {
		const p = nodes.get(e.parent);
		const c = nodes.get(e.child);
		if (!p || !c) continue;
		const key = `${e.parent}|${c.row}|${e.kind}`;
		const g = out.get(key) ?? {
			key,
			parent: p,
			row: c.row,
			x0: p.x,
			x1: p.x,
			level: 0,
			column: p.x,
			edges: []
		};
		g.x0 = Math.min(g.x0, c.x);
		g.x1 = Math.max(g.x1, c.x);
		g.edges.push(e);
		out.set(key, g);
	}
	return [...out.values()];
}

/** The lines of a keten: a path for each edge, none through a box, the taks of a layer apart. */
export function stamboom(
	nodes: ReadonlyMap<string, StamNode>,
	edges: readonly StamEdge[],
	o: { rails: readonly number[]; boxes: readonly Box[] }
): StamLine[] {
	const all = groups(nodes, edges);
	// Straight down the parent's own column where nothing stands in the way, else beside it.
	for (const g of all) {
		const ends = new Set(g.edges.flatMap((e) => [e.parent, e.child]));
		const startRow = g.parent.row;
		g.column =
			g.row > startRow + 1
				? freeColumn(
						g.parent.x,
						o.rails[startRow + 1],
						o.rails[g.row],
						o.boxes,
						ends,
						// The taks of other parents in the layers between: a line down does not cross them.
						all.filter((t) => t.parent !== g.parent && t.row > startRow && t.row < g.row)
					)
				: g.parent.x;
	}
	for (const g of all) {
		g.x0 = Math.min(g.x0, g.column);
		g.x1 = Math.max(g.x1, g.column);
	}
	// Taks of one layer that would overlap stand on levels of their own.
	const rows = new Map<number, Group[]>();
	for (const g of all) rows.set(g.row, [...(rows.get(g.row) ?? []), g]);
	for (const gs of rows.values()) {
		const taken: Group[] = [];
		for (const g of [...gs].sort((a, b) => a.x0 - b.x0)) {
			let level = 0;
			while (
				level < MAX_LEVEL &&
				taken.some((t) => t.level === level && t.x1 + 8 > g.x0 && g.x1 + 8 > t.x0)
			)
				level++;
			g.level = level;
			taken.push(g);
		}
	}
	// A child with several lines in has them side by side, the one from the left on the left,
	// so the lines do not cross as they arrive.
	const arriving = new Map<string, { id: string; from: number }[]>();
	for (const g of all)
		for (const e of g.edges)
			arriving.set(e.child, [...(arriving.get(e.child) ?? []), { id: e.id, from: g.column }]);
	const slot = (child: string, id: string) => {
		const list = (arriving.get(child) ?? []).sort((a, b) => a.from - b.from);
		return list.findIndex((x) => x.id === id) - (list.length - 1) / 2;
	};
	const out: StamLine[] = [];
	for (const g of all) {
		const startRow = g.parent.row;
		const yg = o.rails[g.row] - LEVEL * g.level;
		// A line that steps aside runs above the taks of the layer, so it does not lie on one.
		const side = o.rails[startRow + 1] - LEVEL * (MAX_LEVEL + 1);
		for (const e of g.edges) {
			const c = nodes.get(e.child)!;
			const cx = c.x + slot(e.child, e.id) * SPREAD;
			const tip = { x: g.parent.x, y: g.parent.bottom };
			const begin = { x: tip.x, y: tip.y + (e.lead ?? 0) };
			const pts: Pt[] = [begin];
			if (g.column !== g.parent.x) pts.push({ x: g.parent.x, y: side }, { x: g.column, y: side });
			pts.push({ x: g.column, y: yg }, { x: cx, y: yg }, { x: cx, y: c.top });
			const points = tidy(pts);
			out.push({
				id: e.id,
				parent: e.parent,
				child: e.child,
				kind: e.kind,
				d: easePath(points),
				points,
				tip,
				end: { x: cx, y: c.top }
			});
		}
	}
	return out;
}
