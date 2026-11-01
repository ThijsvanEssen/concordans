// The lanes on a phone: the columns as strips from top to bottom (Wie maakt, Kamerstukken, Wetten,
// Rechtspraak, Algemene wetten), from the design of phase 0. Wie maakt is a row of marks with one
// line that counts them; a chosen hull stands in full with a line per row; every other unit is a
// mark in a grid, a hull outside the focus as a disc with its count. At most NAMED units carry a
// name under their mark (the chosen first, then the changed wetten, then the largest). Only the lines to the chosen units
// are drawn, those of Wie maakt as one per lijnsoort. A line runs down out of what it leaves (under
// a chosen hull, or along the edge of a cell), across in a channel (under a chosen hull, or under
// the head of a strip) and into its target from above (a hull) or from the side (a mark in the
// grid). Where it changes channel it goes down the free lane at the right, which no hull or cell
// reaches: so it runs through no mark.
// Pure: the same LaneLayout as lane-layout.ts, so one view draws both.
import { easePath, type Pt } from '$lib/network/tree-lines';
import {
	CHANGED_ROOM,
	tilesBox,
	wrapLabel,
	type Box,
	type LaneLayout,
	type UnitBox
} from './lane-layout';
import { fromTheEnd, LINE_WIDTH, straight, type LanePath } from './lane-lines';
import { hasArrow, LINE_KIND_STYLE } from './line-kind';
import { MAKER_LANE_ORDER } from './roles';
import type { Column, Scene, SceneLine, SceneUnit } from './scene';

const MARGIN = 16;
const INSET = 12;
const HEAD = 40;
const STRIP_GAP = 14;
const CELL = 80;
/** A name under a mark keeps this far from the edges of its cell, where the lines run. */
const CELL_AIR = 4;
const GLYPH = 14;
const PILL = 26;
const ROW = 24;
const NAME_LINE = 15;
/** Names under a mark: at most this many units carry one. */
const NAMED = 6;
const CHANNEL_STEP = 6;
const TIP = 4;
/** Where the lines of Wie maakt come down: right of the head of the strip below. */
const PAST_HEAD = 160;
/** A chosen hull is at most this wide: right of it, and of the cells, the lines go down. */
const HULL_MAX = 260;
/** The lines in the free lane at the right stand this far apart. */
const LANE_STEP = 4;

const STRIP_ORDER: readonly (Column | 'general')[] = [
	'makers',
	'papers',
	'laws',
	'rulings',
	'general'
];

/** What the strips add to a layout: which units carry a name, the channels. */
export type StripLayout = LaneLayout & {
	named: ReadonlySet<string>;
	/** The strip of each unit, by its place from the top. */
	stripOf: ReadonlyMap<string, number>;
	/** Under each chosen hull, the channel its lines run across in. */
	bands: ReadonlyMap<string, Box>;
	/** The height of each channel's first line, by its key (`channelsOf`). */
	channels: ReadonlyMap<string, number>;
};

const laneRank = (u: SceneUnit) =>
	u.lane ? MAKER_LANE_ORDER.indexOf(u.lane) : MAKER_LANE_ORDER.length;

const stripKey = (u: SceneUnit): Column | 'general' => (u.general ? 'general' : u.column);

/** The radius of a disc by its count, as lane-layout draws a group. */
const discRadius = (n: number): number => (n < 10 ? 10 : n < 30 ? 12 : 15);

/** A disc or a mark with its name below, centred in a cell. */
function cellBox(u: SceneUnit, x: number, y: number, named: boolean, disc: boolean): UnitBox {
	const r = disc ? discRadius(u.members.length) : GLYPH / 2;
	const cx = x + CELL / 2;
	const mark = { x: cx - r, y, width: 2 * r, height: 2 * r };
	const label = named
		? { x: x + CELL_AIR, y: y + 2 * r + 4, width: CELL - 2 * CELL_AIR, height: 2 * NAME_LINE }
		: { x: cx, y: y + 2 * r, width: 0, height: 0 };
	const bottom = label.y + label.height;
	const text = { name: named ? wrapLabel(u.label, label.width, 13, 2) : [], small: [] };
	return { x, y, width: CELL, height: bottom - y, mark, label, rows: [], text };
}

/** A chosen hull in full: its name in a pill, below it a line per row. */
function hullBox(u: SceneUnit, x: number, y: number, width: number): UnitBox {
	const wide = Math.min(width, HULL_MAX);
	const label = { x, y, width: wide, height: PILL - 4 };
	const top = y + PILL;
	const rows = u.rows.map((r, i) => ({ id: r.id, y: top + 14 + i * ROW }));
	const mark = { x, y: top, width: wide, height: 8 + u.rows.length * ROW + 8 };
	const room = wide - 20 - (u.change ? CHANGED_ROOM : 0);
	const text = { name: wrapLabel(u.label, room, 13, 1), small: [] };
	return { x, y, width, height: mark.y + mark.height - y, mark, label, rows, text };
}

const changeRank = (u: SceneUnit) => (u.change === 'enacted' ? 2 : u.change === 'proposed' ? 1 : 0);

const byWeight = (a: SceneUnit, b: SceneUnit) =>
	Number(b.focus) - Number(a.focus) ||
	changeRank(b) - changeRank(a) ||
	b.members.length - a.members.length ||
	a.label.localeCompare(b.label) ||
	a.id.localeCompare(b.id);

/** A chosen hull and tiles: on a phone they alone stand in full. */
const isFull = (u: SceneUnit) => (u.shape === 'hull' && u.focus) || u.shape === 'tiles';

/** The units that carry a name: the chosen ones, the changed wetten, the largest; NAMED at most. */
function namedOf(scene: Scene): Set<string> {
	const units = scene.units.filter((u) => u.column !== 'makers' && !isFull(u));
	return new Set(
		[...units]
			.sort(byWeight)
			.slice(0, NAMED)
			.map((u) => u.id)
	);
}

type Strip = { key: Column | 'general'; units: SceneUnit[] };

/** What placing a strip needs beside it, and what it records. */
type Place = {
	right: number;
	named: ReadonlySet<string>;
	units: Map<string, UnitBox>;
	bands: Map<string, Box>;
	channels: Map<string, number>;
	/** How many lines run across in a channel, by its key. */
	load: ReadonlyMap<string, number>;
};

/** The grid of a strip: its units in cells, a new line where the width ends. */
function placeGrid(units: readonly SceneUnit[], y0: number, p: Place): number {
	const x0 = MARGIN + INSET;
	const perLine = Math.max(1, Math.floor((p.right - x0) / CELL));
	let [y, col, line] = [y0, 0, 0];
	for (const u of [...units].sort(byWeight)) {
		if (col === perLine) [y, col, line] = [y + line + 12, 0, 0];
		const box = cellBox(u, x0 + col * CELL, y, p.named.has(u.id), u.shape !== 'node');
		p.units.set(u.id, box);
		line = Math.max(line, box.height);
		col++;
	}
	return col > 0 ? y + line : y;
}

/** A strip under its head: the channel of what comes in, each chosen hull in full, then the grid. */
function placeStrip(strip: Strip, index: number, top: number, p: Place): number {
	const x0 = MARGIN + INSET;
	const load = (key: string) => (p.load.get(key) ?? 0) * CHANNEL_STEP;
	p.channels.set(`entry:${index}`, top + HEAD);
	let y = top + HEAD + load(`entry:${index}`);
	for (const u of strip.units.filter(isFull)) {
		const box =
			u.shape === 'tiles'
				? tilesBox(u, x0, y, Math.min(p.right - x0, HULL_MAX))
				: hullBox(u, x0, y, p.right - x0);
		p.units.set(u.id, box);
		const band = { x: x0, y: box.y + box.height, width: p.right - x0, height: 0 };
		band.height = 10 + load(`band:${u.id}`) + load(`pass:${u.id}`);
		p.bands.set(u.id, band);
		p.channels.set(`band:${u.id}`, band.y + 6);
		p.channels.set(`pass:${u.id}`, band.y + 6 + load(`band:${u.id}`));
		y = band.y + band.height + 10;
	}
	const rest = strip.units.filter((u) => !isFull(u));
	return placeGrid(rest, y, p) + 16;
}

/** Wie maakt on a phone: a row of marks, a new row where the width ends; one line counts them. */
function placeMakers(makers: readonly SceneUnit[], top: number, p: Place): number {
	const x0 = MARGIN + INSET;
	let x = x0 + GLYPH / 2;
	let y = top + HEAD + 4;
	for (const u of [...makers].sort(
		(a, b) => laneRank(a) - laneRank(b) || a.id.localeCompare(b.id)
	)) {
		if (x + GLYPH > p.right) [x, y] = [x0 + GLYPH / 2, y + 22];
		const mark = { x: x - GLYPH / 2, y, width: GLYPH, height: GLYPH };
		const label = { x, y: y + GLYPH, width: 0, height: 0 };
		p.units.set(u.id, { ...mark, mark, label, rows: [], text: { name: [], small: [] } });
		x += 18;
	}
	return y + GLYPH + 8 + NAME_LINE + 12;
}

/** The lines a phone draws: to a chosen unit, between two strips or under a chosen hull. */
function drawnOnPhone(l: SceneLine, focus: ReadonlySet<string>, w: Where): boolean {
	if (!(focus.has(l.from) || focus.has(l.to))) return false;
	if (!w.stripOf.has(l.from) || !w.stripOf.has(l.to)) return false;
	return w.stripOf.get(l.from) !== w.stripOf.get(l.to) || w.full.has(l.from) || w.full.has(l.to);
}

/** Where the units stand before they are placed: their strip, and the chosen hulls of each. */
type Where = {
	stripOf: ReadonlyMap<string, number>;
	full: ReadonlySet<string>;
	/** Per strip, its chosen hulls from the top. */
	hulls: ReadonlyMap<number, string[]>;
	makers: boolean;
};

const isMakerIn = (w: Where, id: string) => w.makers && w.stripOf.get(id) === 0;

/** The upper end of a line, the one it runs down from: the earlier strip, else the chosen hull. */
function upperOf(l: SceneLine, w: Where): string {
	const a = w.stripOf.get(l.from)!;
	const b = w.stripOf.get(l.to)!;
	return a < b || (a === b && w.full.has(l.from)) ? l.from : l.to;
}

/**
 * The channels of a line: the one it leaves in (under its chosen hull, or under the head of the
 * strip below its own) and the one it arrives in (above the chosen hull it goes to, or above the
 * grid of its strip: under the last chosen hull there, else under the head).
 */
function channelsOf(l: SceneLine, w: Where): { first: string; last: string } {
	const up = upperOf(l, w);
	const low = up === l.from ? l.to : l.from;
	const strip = w.stripOf.get(low)!;
	const hulls = w.hulls.get(strip) ?? [];
	const at = hulls.indexOf(low);
	const above = at > 0 ? hulls[at - 1] : at === 0 ? null : (hulls.at(-1) ?? null);
	const last = above ? `pass:${above}` : `entry:${strip}`;
	if (w.full.has(up))
		return {
			first: `band:${up}`,
			last: strip === w.stripOf.get(up) && at < 0 && above === up ? `band:${up}` : last
		};
	return { first: `entry:${w.stripOf.get(up)! + 1}`, last };
}

/** The layout of a scene in strips on a screen `width` px wide. */
export function laneStrips(scene: Scene, width: number): StripLayout {
	const strips: Strip[] = STRIP_ORDER.map((key) => ({
		key,
		units: scene.units.filter((u) => stripKey(u) === key)
	})).filter((s) => s.units.length > 0);
	const w = whereOf(scene, strips);
	const focus = new Set(scene.units.filter((u) => u.focus).map((u) => u.id));
	const load = new Map<string, number>();
	const seen = new Set<string>();
	for (const l of scene.lines.filter((k) => drawnOnPhone(k, focus, w))) {
		// The lines of Wie maakt to one unit run as one per lijnsoort (makersLeg).
		const maker = isMakerIn(w, l.from) ? l.to : isMakerIn(w, l.to) ? l.from : null;
		if (maker !== null && seen.has(`${maker}:${l.kind}`)) continue;
		if (maker !== null) seen.add(`${maker}:${l.kind}`);
		for (const key of new Set(Object.values(channelsOf(l, w))))
			load.set(key, (load.get(key) ?? 0) + 1);
	}
	const p: Place = {
		right: width - MARGIN - INSET,
		named: namedOf(scene),
		units: new Map(),
		bands: new Map(),
		channels: new Map(),
		load
	};
	const columns: LaneLayout['columns'] = [];
	let strip: Box | null = null;
	let y = STRIP_GAP;
	strips.forEach((s, i) => {
		const bottom = s.key === 'makers' ? placeMakers(s.units, y, p) : placeStrip(s, i, y, p);
		const box = { x: MARGIN, y, width: width - 2 * MARGIN, height: bottom - y };
		if (s.key === 'general') strip = box;
		else columns.push({ ...box, column: s.key, inner: 0 });
		y = bottom + STRIP_GAP;
	});
	return {
		width,
		height: y,
		columns,
		lanes: [],
		strip,
		heads: [],
		units: p.units,
		named: p.named,
		stripOf: w.stripOf,
		bands: p.bands,
		channels: p.channels
	};
}

function whereOf(scene: Scene, strips: readonly Strip[]): Where {
	return {
		stripOf: new Map(strips.flatMap((s, i) => s.units.map((u) => [u.id, i] as const))),
		full: new Set(scene.units.filter(isFull).map((u) => u.id)),
		hulls: new Map(strips.map((s, i) => [i, s.units.filter(isFull).map((u) => u.id)])),
		makers: strips[0]?.key === 'makers'
	};
}

const whereIn = (layout: StripLayout): Where => {
	const hulls = new Map<number, string[]>();
	for (const id of layout.bands.keys()) {
		const i = layout.stripOf.get(id)!;
		hulls.set(i, [...(hulls.get(i) ?? []), id]);
	}
	for (const list of hulls.values())
		list.sort((a, b) => layout.units.get(a)!.y - layout.units.get(b)!.y);
	return {
		stripOf: layout.stripOf,
		full: new Set(layout.bands.keys()),
		hulls,
		makers: layout.columns[0]?.column === 'makers'
	};
};

// ── the lines ────────────────────────────────────────────────────────────────

/** A line on a phone, before its channels are shared out. */
type Leg = {
	id: string;
	from: string;
	to: string;
	kind: SceneLine['kind'];
	count: number;
	/** From the upper end to where it runs down; its last point's x is the descent. */
	out: Pt[];
	/** From where it comes down to the lower end; its first point's x is the descent. */
	in: Pt[];
	/** From the upper end to the lower one: as the line points, or against it. */
	down: boolean;
	first: string;
	last: string;
};

const centreX = (b: Box) => b.x + b.width / 2;
const centreY = (b: Box) => b.y + b.height / 2;
const isCell = (b: UnitBox) => b.rows.length === 0 && b.width === CELL;

/** Out of the upper end: a hull at a point spread over its lower edge, a cell along its right edge. */
function outOf(box: UnitBox, slot: number, of: number): Pt[] {
	if (box.rows.length > 0)
		return [
			{
				x: box.mark.x + (box.mark.width / (of + 1)) * (slot + 1),
				y: box.mark.y + box.mark.height
			}
		];
	if (!isCell(box)) return [{ x: centreX(box.mark), y: box.y + box.height }];
	const y = centreY(box.mark);
	return [
		{ x: box.mark.x + box.mark.width + 2, y },
		{ x: box.x + box.width - 2, y }
	];
}

/** Into the lower end: a hull at its pill, a cell from the left, along its edge. */
function inOf(box: UnitBox, near: number): Pt[] {
	if (box.rows.length > 0) {
		const x = Math.max(box.label.x + 24, Math.min(box.label.x + box.label.width - 24, near));
		return [{ x, y: box.label.y - TIP }];
	}
	if (!isCell(box)) return [{ x: centreX(box.mark), y: box.mark.y - TIP }];
	const y = centreY(box.mark);
	return [
		{ x: box.x + 2, y },
		{ x: box.mark.x - TIP, y }
	];
}

/** One line between two units. */
function legOf(l: SceneLine, layout: StripLayout, w: Where, slots: Map<string, string[]>): Leg {
	const upId = upperOf(l, w);
	const lowId = upId === l.from ? l.to : l.from;
	const own = slots.get(upId) ?? [];
	const out = outOf(layout.units.get(upId)!, Math.max(0, own.indexOf(l.id)), own.length);
	return {
		id: l.id,
		from: l.from,
		to: l.to,
		kind: l.kind,
		count: l.count,
		out,
		in: inOf(layout.units.get(lowId)!, out.at(-1)!.x),
		down: upId === l.from,
		...channelsOf(l, w)
	};
}

/** The lines of Wie maakt to one unit and of one lijnsoort, as one from under the strip. */
function makersLeg(lines: readonly SceneLine[], other: string, layout: StripLayout, w: Where): Leg {
	const makers = layout.columns[0];
	const x = Math.max(MARGIN + PAST_HEAD, makers.x + makers.width / 2);
	const fromMaker = lines[0].to === other;
	return {
		id: `makers:${other}:${lines[0].kind}`,
		from: fromMaker ? lines[0].from : other,
		to: fromMaker ? other : lines[0].to,
		kind: lines[0].kind,
		count: lines.reduce((n, l) => n + l.count, 0),
		out: [{ x, y: makers.y + makers.height }],
		in: inOf(layout.units.get(other)!, x),
		down: fromMaker,
		...channelsOf(lines[0], w)
	};
}

/** The lines on a phone, those of Wie maakt to one unit as one per lijnsoort. */
function legsOf(scene: Scene, layout: StripLayout): Leg[] {
	const w = whereIn(layout);
	const focus = new Set(scene.units.filter((u) => u.focus).map((u) => u.id));
	const kept = scene.lines.filter((l) => drawnOnPhone(l, focus, w));
	const own = kept.filter((l) => !isMakerIn(w, l.from) && !isMakerIn(w, l.to));
	const slots = new Map<string, string[]>();
	for (const l of own) {
		const up = upperOf(l, w);
		slots.set(up, [...(slots.get(up) ?? []), l.id]);
	}
	const legs = own.map((l) => legOf(l, layout, w, slots));
	const merged = new Map<string, { lines: SceneLine[]; other: string }>();
	for (const l of kept.filter((k) => !own.includes(k))) {
		const other = isMakerIn(w, l.from) ? l.to : l.from;
		const key = `${other}:${l.kind}`;
		merged.set(key, { lines: [...(merged.get(key)?.lines ?? []), l], other });
	}
	for (const m of merged.values()) legs.push(makersLeg(m.lines, m.other, layout, w));
	return legs;
}

/** Per channel, the place of each line in it: in the order of where they come down. */
function levelsOf(legs: readonly Leg[]): Map<string, number> {
	const byChannel = new Map<string, Leg[]>();
	for (const g of legs)
		for (const key of new Set([g.first, g.last]))
			byChannel.set(key, [...(byChannel.get(key) ?? []), g]);
	const level = new Map<string, number>();
	for (const [key, list] of byChannel)
		[...list]
			.sort((a, b) => a.in[0].x - b.in[0].x || a.out[0].x - b.out[0].x || a.id.localeCompare(b.id))
			.forEach((g, i) => level.set(`${key}|${g.id}`, i));
	return level;
}

/** The lines of a scene on its strips: only those with a chosen unit at one end. */
export function stripLines(scene: Scene, layout: StripLayout): LanePath[] {
	const legs = legsOf(scene, layout);
	const level = levelsOf(legs);
	const yIn = (key: string, id: string) =>
		(layout.channels.get(key) ?? 0) + (level.get(`${key}|${id}`) ?? 0) * CHANNEL_STEP;
	const lane = layout.width - MARGIN - 6;
	return legs.map((g, i) => {
		const y1 = yIn(g.first, g.id);
		const y2 = yIn(g.last, g.id);
		const turn: Pt[] =
			g.first === g.last
				? [{ x: g.out.at(-1)!.x, y: y1 }]
				: [
						{ x: g.out.at(-1)!.x, y: y1 },
						{ x: lane - (i % 8) * LANE_STEP, y: y1 },
						{ x: lane - (i % 8) * LANE_STEP, y: y2 }
					];
		const run: Pt[] = [...g.out, ...turn, { x: g.in[0].x, y: y2 }, ...g.in];
		const points = straight(g.down ? run : run.reverse());
		const { stroke } = LINE_KIND_STYLE[g.kind];
		return {
			id: g.id,
			from: g.from,
			to: g.to,
			d: fromTheEnd(easePath(points)),
			points,
			stroke,
			arrow: hasArrow(stroke),
			width: LINE_WIDTH
		};
	});
}
