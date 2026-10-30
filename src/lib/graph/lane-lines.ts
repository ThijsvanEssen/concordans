// The lines of Omgeving as lanes, as the Keten draws them (tree-lines.ts): straight runs with eased
// bends. A line leaves its bron, runs to a rail in the gutter before the column of its target and
// along it to the height of its target (the row it ends in), then into the target. Through a
// column between the two it keeps to a corridor where nothing stands; out of a hull its lines
// leave from points spread over its side in the order of their targets; within one column a line
// runs on a rail right of the column; to the strip Algemene wetten it runs above the strip and
// drops in. Each pair of rails in a gutter stands in the order that does not cross where the
// other would.
// Pure: the view draws what this returns, with the dot, the arrow and the dash of its lijnsoort.
import { easePath, type Pt } from '$lib/network/tree-lines';
import { GUTTER, ITEM_GAP, PANEL, type Box, type LaneLayout, type UnitBox } from './lane-layout';
import { hasArrow, LINE_KIND_STYLE, type Stroke } from './line-kind';
import type { Scene, SceneLine } from './scene';

/** Rails in a gutter stand this far apart at most. */
const RAIL_STEP = 7;
/** Rails of one bundle stand this part of a step apart. */
const BUNDLE = 0.3;
/** The room between a line and the edge of what it passes. */
const AIR = 6;
/** Where a line arrives at a mark, this far off its edge (the arrow's tip). */
const TIP = 4;

export type LanePath = {
	id: string;
	from: string;
	to: string;
	/** The bezier path, from the dot at the bron to the tip of the arrow. */
	d: string;
	/** The skeleton of the path: its runs before the bends are eased. */
	points: Pt[];
	stroke: Stroke;
	arrow: boolean;
	/** The width of the line by the number of edges it stands for. */
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
	/** Rails with one key run into one point, or out of one: side by side they run as a bundle. */
	key: string;
	x: number;
};

const centreY = (b: Box) => b.y + b.height / 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const widthOf = (count: number) =>
	Math.round((1.2 + Math.min(2.8, Math.log2(count) * 0.8)) * 10) / 10;

type Frames = { x: number; width: number }[];

/** The column index of each unit: its column, or -1 for the strip. */
function columnIndex(scene: Scene, layout: LaneLayout): Map<string, number> {
	const order = layout.columns.map((c) => c.column);
	return new Map(scene.units.map((u) => [u.id, u.general ? -1 : order.indexOf(u.column)]));
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

/** A line of the strip: its top and its boxes from left to right. */
type StripRow = { top: number; boxes: UnitBox[] };

type Context = {
	scene: Scene;
	layout: LaneLayout;
	index: Map<string, number>;
	frames: Frames;
	columns: UnitBox[][];
	strip: StripRow[];
};

/** The lines of the strip, from the top. */
function stripRows(layout: LaneLayout, index: Map<string, number>): StripRow[] {
	const byTop = new Map<number, UnitBox[]>();
	for (const [id, box] of layout.units)
		if (index.get(id) === -1) byTop.set(box.y, [...(byTop.get(box.y) ?? []), box]);
	return [...byTop]
		.sort((a, b) => a[0] - b[0])
		.map(([top, boxes]) => ({ top, boxes: boxes.sort((a, b) => a.x - b.x) }));
}

const rowOf = (c: Context, box: UnitBox) => c.strip.findIndex((r) => r.boxes.includes(box));

/** The height a line runs at above line `r` of the strip: above the strip for the first. */
const gangAbove = (c: Context, r: number) =>
	r === 0 ? c.layout.strip!.y - AIR * 2 : c.strip[r].top - ITEM_GAP / 2;

/** A way down through line `r` of the strip: a space between two boxes, or beside them, nearest `toward`. */
function passage(c: Context, r: number, toward: number): number {
	const { boxes } = c.strip[r];
	const strip = c.layout.strip!;
	const ends = boxes.map((b) => b.x + b.width);
	const ways = [
		strip.x + PANEL / 2,
		...boxes.slice(1).map((b, i) => (ends[i] + b.x) / 2),
		Math.min(ends.at(-1)! + 22, strip.x + strip.width - PANEL / 2)
	];
	return ways.sort((a, b) => Math.abs(a - toward) - Math.abs(b - toward))[0];
}

/**
 * From the top of a unit in the strip up to the height above line `to` of the strip: through the
 * lines between by a space between their boxes.
 */
function climb(c: Context, box: UnitBox, to: number, toward: number): Pt[] {
	const from = rowOf(c, box);
	const x0 = box.mark.x + box.mark.width / 2;
	const pts = [
		{ x: x0, y: box.mark.y - TIP },
		{ x: x0, y: gangAbove(c, from) }
	];
	for (let r = from - 1; r >= to; r--) {
		const x = passage(c, r, toward);
		pts.push({ x, y: gangAbove(c, r + 1) }, { x, y: gangAbove(c, r) });
	}
	return pts;
}

/**
 * Within the strip: from the lower of the two up to the height under the line of the other, then
 * up into it; in one line, over that line and down into it.
 */
function planInStrip(c: Context, line: SceneLine, a: UnitBox, b: UnitBox): Plan {
	const [ra, rb] = [rowOf(c, a), rowOf(c, b)];
	const [low, high] = rb > ra ? [b, a] : [a, b];
	const [rl, rh] = [Math.max(ra, rb), Math.min(ra, rb)];
	const x = high.mark.x + high.mark.width / 2;
	const level = rl === rh ? rl : rh + 1;
	const up = climb(c, low, level, x);
	const end = rl === rh ? high.mark.y - TIP : high.mark.y + high.mark.height + TIP;
	const pts = [...up, { x, y: gangAbove(c, level) }, { x, y: end }];
	return { line, out: low === a ? pts : pts.reverse(), in: [], rails: [] };
}

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
	const into = `in ${line.to} ${y2}`;
	if (ia === ib)
		return {
			line,
			out,
			in: inn,
			rails: [{ gutter: ia, enter: y1, leave: y2, fromLeft: true, toLeft: true, key: into, x: 0 }]
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
		rails.push({ gutter: first, enter: y1, leave: yc, key: `out ${line.from} ${y1}`, ...dir });
	rails.push({ gutter: last, enter: yc, leave: y2, key: into, ...dir });
	return { line, out, in: inn, rails };
}

/** The plan of a line to or from the strip: above the strip to the target's middle, then down. */
function planStrip(
	c: Context,
	line: SceneLine,
	a: UnitBox,
	b: UnitBox,
	ia: number,
	ib: number
): Plan {
	if (ia === -1 && ib === -1) return planInStrip(c, line, a, b);
	const above = gangAbove(c, 0);
	const fromStrip = ia === -1;
	const unit = fromStrip ? b : a;
	const k = fromStrip ? ib : ia;
	const drop = fromStrip ? a : b;
	const down = climb(c, drop, 0, c.frames[k].x).reverse();
	const x = down[0].x;
	const side: Side = x >= c.frames[k].x ? 'right' : 'left';
	const leg = port(
		unit,
		side,
		heightAt(unit, fromStrip ? line.toRow : line.fromRow, above),
		c.frames[k],
		c.columns[k]
	);
	const gutter = side === 'right' ? k : k - 1;
	const [left, right] = gutterOf(c.layout, gutter);
	const rail: Rail = {
		gutter,
		enter: leg.at(-1)!.y,
		leave: above,
		fromLeft: side === 'right',
		toLeft: x < (left + right) / 2,
		key: `strip ${line.id}`,
		x: 0
	};
	return fromStrip
		? {
				line,
				out: [...down].reverse(),
				in: [...leg].reverse(),
				rails: [
					{ ...rail, enter: above, leave: rail.enter, fromLeft: rail.toLeft, toLeft: rail.fromLeft }
				]
			}
		: { line, out: leg, in: down, rails: [rail] };
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
 * The rails from left to right: each pair in the order it crosses least in. Where those orders
 * close a circle, the rail that breaks the least goes first.
 */
function orderRails(rails: Rail[], left: number, right: number): Rail[] {
	const cost = rails.map((a) => rails.map((b) => (a === b ? 0 : leftCost(a, b, left, right))));
	/** What placing `i` left of all the rest breaks: their wish to stand left of it. */
	const breaks = (i: number, rest: number[]) =>
		rest.reduce((sum, j) => sum + Math.max(0, cost[i][j] - cost[j][i]), 0);
	const rest = rails.map((_, i) => i);
	const order: Rail[] = [];
	while (rest.length > 0) {
		let pick = 0;
		for (let k = 1; k < rest.length; k++)
			if (breaks(rest[k], rest) < breaks(rest[pick], rest)) pick = k;
		order.push(rails[rest[pick]]);
		rest.splice(pick, 1);
	}
	return order;
}

/**
 * The x of each rail in a gutter, each pair in the order that does not cross where the other
 * would. Rails into one point (or out of one) that stand side by side run close, as a bundle.
 */
function placeRails(rails: Rail[], left: number, right: number) {
	const sorted = [...rails].sort(
		(a, b) => a.leave - b.leave || a.enter - b.enter || a.key.localeCompare(b.key)
	);
	const order = orderRails(sorted, left, right);
	const gaps: number[] = order.map((r, i) =>
		i === 0 ? 0 : r.key === order[i - 1].key ? BUNDLE : 1
	);
	const units = gaps.reduce((n, g) => n + g, 0);
	const step = units > 0 ? Math.min(RAIL_STEP, (right - left - 2 * AIR) / units) : 0;
	let x = (left + right) / 2 - (units * step) / 2;
	order.forEach((r, i) => {
		x += gaps[i] * step;
		r.x = x;
	});
}

/** The left and right edge of gutter `g`: after column g, before column g + 1 (or the canvas edge). */
function gutterOf(layout: LaneLayout, g: number): [number, number] {
	const col = layout.columns[g];
	const next = layout.columns[g + 1];
	const left = col.x + col.width + PANEL;
	return [left, next ? next.x - PANEL : Math.min(layout.width, left + GUTTER / 2)];
}

function skeleton(p: Plan): Pt[] {
	const pts: Pt[] = [...p.out];
	for (const r of p.rails) pts.push({ x: r.x, y: r.enter }, { x: r.x, y: r.leave });
	pts.push(...p.in);
	return pts.filter(
		(q, i) => i === 0 || Math.abs(q.x - pts[i - 1].x) + Math.abs(q.y - pts[i - 1].y) > 0.5
	);
}

/** The lines of a scene on its layout. */
export function laneLines(scene: Scene, layout: LaneLayout): LanePath[] {
	const index = columnIndex(scene, layout);
	const frames = layout.columns.map((c) => ({ x: c.x, width: c.width }));
	const columns = layout.columns.map((_, i) => boxesIn(layout, index, i));
	const c: Context = { scene, layout, index, frames, columns, strip: stripRows(layout, index) };
	const plans: Plan[] = [];
	for (const line of scene.lines) {
		const a = layout.units.get(line.from);
		const b = layout.units.get(line.to);
		const ia = index.get(line.from);
		const ib = index.get(line.to);
		if (!a || !b || ia === undefined || ib === undefined) continue;
		plans.push(
			ia === -1 || ib === -1 ? planStrip(c, line, a, b, ia, ib) : planBetween(c, line, a, b, ia, ib)
		);
	}
	spread(plans, layout, index);
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
			d: easePath(points),
			points,
			stroke,
			arrow: hasArrow(stroke),
			width: widthOf(p.line.count)
		};
	});
}
