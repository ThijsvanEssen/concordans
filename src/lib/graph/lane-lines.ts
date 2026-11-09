// The lines of Omgeving as lanes, as the Keten draws them (tree-lines.ts): straight runs with eased
// bends. A line leaves its bron, runs to a rail in the gutter before the column of its target and
// along it to the height of its target (the row it ends in), then into the target. Through a
// column between the two it keeps to a corridor where nothing stands; out of a hull its lines
// leave from points spread over its side in the order of their targets; within one column a line
// runs on a rail right of the column. Each pair of rails in a gutter stands in the order that
// does not cross where the other would.
// Pure: the view draws what this returns, with the dot, the arrow and the dash of its lijnsoort.
import { easePath, type Pt } from '$lib/network/tree-lines';
import { bundleKeys, GUTTER, PANEL, type Box, type LaneLayout, type UnitBox } from './lane-layout';
import { hasArrow, LINE_KIND_STYLE, LINE_KINDS, type Stroke } from './line-kind';
import type { Scene, SceneLine } from './scene';

/** Rails in a gutter stand this far apart at most. */
const RAIL_STEP = 10;
/** The room between a line and the edge of what it passes. */
const AIR = 6;

export type LanePath = {
	id: string;
	from: string;
	to: string;
	/** The bezier path, from the tip of the arrow back to the dot at the bron. */
	d: string;
	/** The skeleton of the path: its runs before the bends are eased. */
	points: Pt[];
	stroke: Stroke;
	arrow: boolean;
	width: number;
};

type Side = 'left' | 'right';

/** A line before its rails stand: its legs out of the bron and into the target, and its rails. */
type Plan = {
	line: SceneLine;
	out: Pt[];
	in: Pt[];
	/** The gutters it runs down, in order, each with the height it enters and leaves at. */
	rails: Rail[];
};

type Rail = {
	gutter: number;
	enter: number;
	leave: number;
	fromLeft: boolean;
	toLeft: boolean;
	/**
	 * Rails with one key run as one line: into one target with one lijnsoort, or out of one bron
	 * with one lijnsoort (`bundle`). Lines of two lijnsoorten never share, nor lines of two bronnen
	 * to two targets: that would hide which cites which.
	 */
	key: string;
	x: number;
};

const centreY = (b: Box) => b.y + b.height / 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Every line is as wide: how many verbindingen it stands for, its label says on hover. */
export const LINE_WIDTH = 1.6;

type Frames = { x: number; width: number }[];

/** The column index of each unit. */
function columnIndex(scene: Scene, layout: LaneLayout): Map<string, number> {
	const order = layout.columns.map((c) => c.column);
	return new Map(scene.units.map((u) => [u.id, order.indexOf(u.column)]));
}

/** The boxes that stand in a column, for what a line may not run through. */
function boxesIn(layout: LaneLayout, index: Map<string, number>, column: number): UnitBox[] {
	return [...layout.units].filter(([id]) => index.get(id) === column).map(([, b]) => b);
}

const covers = (b: Box, y: number) => y > b.y - AIR && y < b.y + b.height + AIR;

/**
 * The leg from a unit's edge to the edge of its column at `y`: straight, or, where the other of a
 * pair of dossiers stands in the way, through the gap between them to below the pair.
 */
function port(box: UnitBox, side: Side, y: number, frame: Frames[number], others: UnitBox[]): Pt[] {
	const edge =
		side === 'right'
			? Math.max(box.mark.x + box.mark.width, box.label.x + box.label.width) + AIR
			: box.mark.x - AIR;
	const end = side === 'right' ? frame.x + frame.width + PANEL / 2 : frame.x - PANEL / 2;
	const inWay = others.filter(
		(o) =>
			o !== box &&
			covers(o, y) &&
			(side === 'right' ? o.x >= edge - AIR : o.x + o.width <= edge + AIR)
	);
	if (inWay.length === 0)
		return [
			{ x: edge, y },
			{ x: end, y }
		];
	const near = inWay.sort((a, b) => (side === 'right' ? a.x - b.x : b.x - a.x))[0];
	const gap = side === 'right' ? (edge + near.x) / 2 : (edge + near.x + near.width) / 2;
	const below = Math.max(box.y + box.height, near.y + near.height) + AIR * 2;
	return [
		{ x: edge, y },
		{ x: gap, y },
		{ x: gap, y: below },
		{ x: end, y: below }
	];
}

/** A height in the columns between two that no box covers, nearest to `want`. */
function corridor(columns: UnitBox[][], want: number, floor: number): number {
	const blocked = columns.flat().filter((b) => covers(b, want));
	if (blocked.length === 0) return want;
	const candidates = columns
		.flat()
		.flatMap((b) => [b.y - AIR * 2, b.y + b.height + AIR * 2])
		.filter((y) => !columns.flat().some((b) => covers(b, y)));
	return [...candidates, floor].sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
}

/** Where a line enters or leaves a unit: a node at its middle, a hull at its row or nearest the other end. */
function heightAt(box: UnitBox, row: string | null, toward: number): number {
	const r = row ? box.rows.find((x) => x.id === row) : undefined;
	if (r) return r.y;
	if (box.rows.length === 0) return centreY(box.mark);
	return clamp(toward, box.mark.y + 12, box.mark.y + box.mark.height - 12);
}

type Context = {
	scene: Scene;
	layout: LaneLayout;
	index: Map<string, number>;
	frames: Frames;
	columns: UnitBox[][];
};

/** The plan of a line between two columns, or within one. */
function planBetween(
	c: Context,
	line: SceneLine,
	a: UnitBox,
	b: UnitBox,
	ia: number,
	ib: number
): Plan {
	const ya = heightAt(a, line.fromRow, centreY(b.mark));
	const yb = heightAt(b, line.toRow, ya);
	const sideA: Side = ia <= ib ? 'right' : 'left';
	const sideB: Side = ia < ib ? 'left' : 'right';
	const out = port(a, sideA, ya, c.frames[ia], c.columns[ia]);
	const inn = port(b, sideB, yb, c.frames[ib], c.columns[ib]).reverse();
	const y1 = out.at(-1)!.y;
	const y2 = inn[0].y;
	const into = `to ${line.to} ${line.kind}`;
	if (ia === ib)
		return {
			line,
			out,
			in: inn,
			rails: [
				{ gutter: innerOf(ia), enter: y1, leave: y2, fromLeft: true, toLeft: true, key: into, x: 0 }
			]
		};
	const step = ia < ib ? 1 : -1;
	const between = [];
	for (let k = ia + step; k !== ib; k += step) between.push(c.columns[k]);
	const last = ia < ib ? ib - 1 : ib;
	const first = ia < ib ? ia : ia - 1;
	const floor = c.layout.columns[0].y + c.layout.columns[0].height;
	const yc = between.length === 0 ? y1 : corridor(between, y1, floor);
	const rails: Rail[] = [];
	const dir = { fromLeft: step > 0, toLeft: step < 0, x: 0 };
	if (between.length > 0 && yc !== y1)
		rails.push({
			gutter: first,
			enter: y1,
			leave: yc,
			key: `from ${line.from} ${line.kind}`,
			...dir
		});
	rails.push({ gutter: last, enter: yc, leave: y2, key: into, ...dir });
	return { line, out, in: inn, rails };
}

/**
 * Out of a hull with two lines or more straight out of one side into the gutter beside it: the
 * points spread over that side, in the order of their targets. A line on through a corridor keeps
 * the height its corridor was found for.
 */
function spread(plans: Plan[], layout: LaneLayout, index: Map<string, number>) {
	const bySource = new Map<string, Plan[]>();
	for (const p of plans) {
		const box = layout.units.get(p.line.from)!;
		const right = p.out[1]?.x > p.out[0].x;
		const beside = index.get(p.line.from)! - (right ? 0 : 1);
		if (box.rows.length === 0 || p.line.fromRow || p.out.length !== 2) continue;
		if (p.out[0].y !== p.out[1].y || p.rails[0]?.gutter !== beside) continue;
		const key = `${p.line.from} ${right ? 'r' : 'l'}`;
		bySource.set(key, [...(bySource.get(key) ?? []), p]);
	}
	for (const list of bySource.values()) {
		if (list.length < 2) continue;
		const box = layout.units.get(list[0].line.from)!;
		const lo = box.mark.y + 14;
		const hi = box.mark.y + box.mark.height - 14;
		list.sort((p, q) => p.in[0].y - q.in[0].y || p.line.id.localeCompare(q.line.id));
		list.forEach((p, i) => {
			const y = lo + ((hi - lo) * i) / (list.length - 1);
			p.out = p.out.map((pt) => ({ ...pt, y }));
			if (p.rails[0]) p.rails[0] = { ...p.rails[0], enter: y };
		});
	}
}

/** The run of a rail as a polyline, for counting crossings: in from its side, down, out to its side. */
function railRun(r: Rail, x: number, left: number, right: number): Pt[] {
	return [
		{ x: r.fromLeft ? left : right, y: r.enter },
		{ x, y: r.enter },
		{ x, y: r.leave },
		{ x: r.toLeft ? left : right, y: r.leave }
	];
}

const ccw = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

/** How often two polylines cross (not touch). */
export function crossings(a: readonly Pt[], b: readonly Pt[]): number {
	let n = 0;
	for (let i = 1; i < a.length; i++)
		for (let j = 1; j < b.length; j++) {
			const d1 = ccw(a[i - 1], a[i], b[j - 1]);
			const d2 = ccw(a[i - 1], a[i], b[j]);
			const d3 = ccw(b[j - 1], b[j], a[i - 1]);
			const d4 = ccw(b[j - 1], b[j], a[i]);
			if (d1 * d2 < -1e-6 && d3 * d4 < -1e-6) n++;
		}
	return n;
}

/** The crossings of two rails with `a` left of `b`. */
function leftCost(a: Rail, b: Rail, left: number, right: number): number {
	const [xa, xb] = [left + (right - left) / 3, left + ((right - left) * 2) / 3];
	return crossings(railRun(a, xa, left, right), railRun(b, xb, left, right));
}

/**
 * The bundles of a gutter from left to right: each pair in the order its rails cross least in.
 * Where those orders close a circle, the bundle that breaks the least goes first.
 */
function orderBundles(bundles: Rail[][], left: number, right: number): Rail[][] {
	const sum = (p: Rail[], q: Rail[]) =>
		p.reduce((n, a) => n + q.reduce((m, b) => m + leftCost(a, b, left, right), 0), 0);
	const cost = bundles.map((p) => bundles.map((q) => (p === q ? 0 : sum(p, q))));
	/** What placing `i` left of all the rest breaks: their wish to stand left of it. */
	const breaks = (i: number, rest: number[]) =>
		rest.reduce((n, j) => n + Math.max(0, cost[i][j] - cost[j][i]), 0);
	const rest = bundles.map((_, i) => i);
	const order: number[] = [];
	while (rest.length > 0) {
		let pick = 0;
		for (let k = 1; k < rest.length; k++)
			if (breaks(rest[k], rest) < breaks(rest[pick], rest)) pick = k;
		order.push(rest[pick]);
		rest.splice(pick, 1);
	}
	const single = bundles.map((list) => list.length === 1);
	return settled(order, cost, single).map((i) => bundles[i]);
}

/**
 * The order with each bundle moved to where it crosses least, as long as that still helps. Of two
 * places that cross as often, the one where fewer pairs of lone rails stand in the order they cross
 * most in: a bundle's crossings are the price of one line, two lone rails can always swap.
 */
function settled(
	start: readonly number[],
	cost: readonly number[][],
	single: readonly boolean[]
): number[] {
	let order = [...start];
	let moved = true;
	while (moved) {
		moved = false;
		for (const b of start) {
			const others = order.filter((o) => o !== b);
			const pay = (o: number, left: boolean) => (left ? cost[o][b] : cost[b][o]);
			const at = (k: number) => others.reduce((n, o, i) => n + pay(o, i < k), 0);
			const wrong = (k: number) =>
				single[b]
					? others.reduce((n, o, i) => n + (single[o] && pay(o, i < k) > pay(o, i >= k) ? 1 : 0), 0)
					: 0;
			const better = (k: number, than: number) =>
				at(k) < at(than) || (at(k) === at(than) && wrong(k) < wrong(than));
			let best = order.indexOf(b);
			for (let k = 0; k <= others.length; k++) if (better(k, best)) best = k;
			if (best === order.indexOf(b)) continue;
			order = [...others.slice(0, best), b, ...others.slice(best)];
			moved = true;
		}
	}
	return order;
}

/**
 * The x of each rail in a gutter, each pair of bundles in the order that does not cross where the
 * other would. Rails with one key (a bundle) stand on one x: they run as one line.
 */
function placeRails(rails: Rail[], left: number, right: number) {
	const byKey = new Map<string, Rail[]>();
	const sorted = [...rails].sort(
		(a, b) => a.leave - b.leave || a.enter - b.enter || a.key.localeCompare(b.key)
	);
	for (const r of sorted) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
	const order = orderBundles([...byKey.values()], left, right);
	const units = order.length - 1;
	const step = units > 0 ? Math.min(RAIL_STEP, (right - left - 2 * AIR) / units) : 0;
	const x0 = (left + right) / 2 - (units * step) / 2;
	order.forEach((list, i) => {
		for (const r of list) r.x = x0 + i * step;
	});
}

/** The rails of a column's own lines run inside its panel (`inner`): a gutter of their own. */
const innerOf = (column: number) => -1 - column;

/**
 * The left and right edge of gutter `g`: after column g, before column g + 1 (or the canvas edge);
 * for a column's own rails (`innerOf`), right of its units, inside its panel.
 */
function gutterOf(layout: LaneLayout, g: number): [number, number] {
	if (g < 0) {
		const col = layout.columns[-1 - g];
		const right = col.x + col.width;
		return [right - col.inner + PANEL / 2 + 1, right + PANEL / 2];
	}
	const col = layout.columns[g];
	const next = layout.columns[g + 1];
	const left = col.x + col.width + PANEL;
	return [left, next ? next.x - PANEL : Math.max(left + GUTTER / 2 - PANEL, layout.width - 8)];
}

function skeleton(p: Plan): Pt[] {
	const pts: Pt[] = [...p.out];
	for (const r of p.rails) pts.push({ x: r.x, y: r.enter }, { x: r.x, y: r.leave });
	pts.push(...p.in);
	return straight(pts);
}

/**
 * A skeleton without what adds nothing: a point on top of the one before, or in the middle of a
 * straight run. Easing a run through a point of its own makes a bend where there is none.
 */
export function straight(pts: readonly Pt[]): Pt[] {
	const out: Pt[] = [];
	for (const q of pts) {
		const a = out.at(-2);
		const b = out.at(-1);
		if (b && Math.abs(q.x - b.x) + Math.abs(q.y - b.y) <= 0.5) continue;
		const onLine =
			a &&
			b &&
			((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - q.x) < 0.5) ||
				(Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - q.y) < 0.5));
		if (onLine) out[out.length - 1] = q;
		else out.push(q);
	}
	return out;
}

/** The key of each rail in its gutter (`bundleKeys`). */
function bundle(plans: readonly Plan[]) {
	const own = plans.flatMap((p) => p.rails.map((r) => ({ p, r })));
	const keys = bundleKeys(own.map(({ p, r }) => ({ gutter: r.gutter, ...p.line })));
	own.forEach(({ r }, i) => (r.key = keys[i]));
}

/**
 * A bundle into one target ends in one point: the row most of its lines end in. Many lines into one
 * wet are one line, also where they name different hoofdstukken (each its own row in the hull).
 */
function meet(plans: readonly Plan[]) {
	const byKey = new Map<string, Plan[]>();
	for (const p of plans) {
		const last = p.rails.at(-1);
		if (!last || !last.key.includes(' to ') || p.in.some((q) => q.y !== p.in[0]?.y)) continue;
		byKey.set(last.key, [...(byKey.get(last.key) ?? []), p]);
	}
	for (const list of byKey.values()) {
		const count = new Map<number, number>();
		for (const p of list) count.set(p.in[0].y, (count.get(p.in[0].y) ?? 0) + 1);
		const y = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
		for (const p of list) {
			p.in = p.in.map((q) => ({ ...q, y }));
			const last = p.rails.at(-1)!;
			p.rails[p.rails.length - 1] = { ...last, leave: y };
		}
	}
}

/** Where lines of several lijnsoorten end at one point, each lijnsoort its own entry, this far apart. */
const KIND_APART = 8;

/**
 * Lines of two lijnsoorten into one point would end in one arrowhead: each lijnsoort gets its own
 * entry beside the others (the dossiers that name a wet, and the toelichting that explains it).
 */
function byKind(plans: readonly Plan[]) {
	const at = new Map<string, Plan[]>();
	for (const p of plans) {
		if (p.rails.length === 0 || p.in.length === 0 || p.in.some((q) => q.y !== p.in[0].y)) continue;
		const key = `${p.line.to} ${p.in[0].y}`;
		at.set(key, [...(at.get(key) ?? []), p]);
	}
	for (const list of at.values()) {
		const kinds = [...new Set(list.map((p) => p.line.kind))].sort(
			(a, b) => LINE_KINDS.indexOf(a) - LINE_KINDS.indexOf(b)
		);
		if (kinds.length < 2) continue;
		for (const p of list) {
			const dy = (kinds.indexOf(p.line.kind) - (kinds.length - 1) / 2) * KIND_APART;
			p.in = p.in.map((q) => ({ ...q, y: q.y + dy }));
			const last = p.rails.at(-1)!;
			p.rails[p.rails.length - 1] = { ...last, leave: last.leave + dy };
		}
	}
}

/**
 * A path of M, L, Q and C drawn the other way: the same curve, from its arrowhead back to its bron.
 * A dash pattern begins where the path does, so the dashes of a bundle fall on one another.
 */
export function fromTheEnd(d: string): string {
	const t = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g) ?? [];
	const parts: { c: string; v: number[] }[] = [];
	for (let i = 0; i < t.length; ) {
		const c = t[i++];
		const n = c === 'Q' ? 4 : c === 'C' ? 6 : 2;
		parts.push({ c, v: t.slice(i, i + n).map(Number) });
		i += n;
	}
	const ends = parts.map((p) => p.v.slice(-2));
	let out = `M${ends.at(-1)!.join(' ')}`;
	for (let k = parts.length - 1; k > 0; k--) {
		const { c, v } = parts[k];
		const to = ends[k - 1].join(' ');
		if (c === 'Q') out += `Q${v[0]} ${v[1]} ${to}`;
		else if (c === 'C') out += `C${v[2]} ${v[3]} ${v[0]} ${v[1]} ${to}`;
		else out += `L${to}`;
	}
	return out;
}

/** The lines of a scene on its layout. */
export function laneLines(scene: Scene, layout: LaneLayout): LanePath[] {
	const index = columnIndex(scene, layout);
	const frames = layout.columns.map((c) => ({ x: c.x, width: c.width - c.inner }));
	const columns = layout.columns.map((_, i) => boxesIn(layout, index, i));
	const c: Context = { scene, layout, index, frames, columns };
	const plans: Plan[] = [];
	for (const line of scene.lines) {
		const a = layout.units.get(line.from);
		const b = layout.units.get(line.to);
		const ia = index.get(line.from);
		const ib = index.get(line.to);
		if (!a || !b || ia === undefined || ib === undefined) continue;
		plans.push(planBetween(c, line, a, b, ia, ib));
	}
	spread(plans, layout, index);
	bundle(plans);
	meet(plans);
	byKind(plans);
	const byGutter = new Map<number, Rail[]>();
	for (const p of plans)
		for (const r of p.rails) byGutter.set(r.gutter, [...(byGutter.get(r.gutter) ?? []), r]);
	for (const [g, rails] of byGutter) placeRails(rails, ...gutterOf(layout, g));
	return plans.map((p) => {
		const points = skeleton(p);
		const { stroke } = LINE_KIND_STYLE[p.line.kind];
		return {
			id: p.line.id,
			from: p.line.from,
			to: p.line.to,
			d: fromTheEnd(easePath(points)),
			points,
			stroke,
			arrow: hasArrow(stroke),
			width: LINE_WIDTH
		};
	});
}
