// The layout of the scene of Omgeving as lanes (scene.ts): fixed column widths with a gutter of
// GUTTER px between them for the rails of the lines, HULL_GAP px of air under a hull and ITEM_GAP
// under a bron, Wetten one bron a line, in Kamerstukken only small dossiers in pairs, Wie maakt
// in three cards (Regering, Raad van State, Parlement), the strip Algemene wetten under the highest
// column; the canvas is as high as what it holds. In Tijd, Kamerstukken and Rechtspraak stand by
// their date (time-axis.ts). Pure and deterministic: text is measured by an estimate, not the DOM.
import { MAKER_LANE_ORDER, type MakerLane } from './roles';
import type { Column, Scene, SceneLine, SceneUnit } from './scene';
import { yearFraction } from '$lib/text/datum';
import { axisY, timeAxis, type TimeAxis } from './time-axis';

export const GUTTER = 76;
const HULL_GAP = 56;
export const ITEM_GAP = 30;
/** The edge of a column's panel around what it holds. */
export const PANEL = 14;

const COLUMN_ORDER: readonly Column[] = ['makers', 'papers', 'laws', 'rulings'];
const FIXED_WIDTH: Partial<Record<Column, number>> = { makers: 178, papers: 300, rulings: 206 };
const LAWS_MIN = 220;
/** Where the columns start: under their heads, which stand above the panels. */
export const CONTENT_TOP = 116;
const MARGIN_LEFT = 36;
/** In Tijd the axis stands left of the columns. */
const MARGIN_LEFT_TIMED = 78;
/** Right of the last column: room for its panel and the rails of its gutter (lane-lines). */
const MARGIN_RIGHT = PANEL + GUTTER / 2 + 8;
const LANE_HEAD = 26;
const LANE_SPACE = 22;
const STRIP_SPACE = 24;
const STRIP_HEAD = 44;

const LINE = 15;
const SMALL_LINE = 14;
const GLYPH = 14;
const HULL_PILL = 26;
const DOT = 20;
const DOT_LINE = 22;
const ROW_HEAD = 20;
const MAX_LINES = 3;
/** The name in a hull's pill: 12 px semibold, measured as 13; its padding left and right. */
const PILL_SIZE = 13;
const PILL_PAD = 20;

export type Box = { x: number; y: number; width: number; height: number };

export type UnitBox = Box & {
	/** The mark: a node's glyph, a group's disc, a hull's rectangle. */
	mark: Box;
	/** The name beside the mark, or a hull's pill above it. */
	label: Box;
	/** A hull's rows, by the height of their first line of members. */
	rows: { id: string; y: number }[];
	/** The text as measured: the name's lines (a hull's pill: one), and the smaller lines under it. */
	text: { name: string[]; small: string[] };
};

/** A column's panel; `inner`: the room at its right, inside the panel, for the rails of its own lines. */
type ColumnBox = Box & { column: Column; inner: number };

export type LaneLayout = {
	width: number;
	height: number;
	columns: ColumnBox[];
	/** The cards of Wie maakt. */
	lanes: (Box & { lane: MakerLane })[];
	/** The strip Algemene wetten, when something stands in it. */
	strip: Box | null;
	units: Map<string, UnitBox>;
	/** The axis of Tijd; null when Tijd is off or nothing has a date. */
	axis: TimeAxis | null;
};

/** The width of a text, estimated: half the font size a character, a capital seven tenths. */
const textWidth = (text: string, size = 13): number =>
	[...text].reduce((w, ch) => w + (/[A-Z]/.test(ch) ? 0.7 : 0.5), 0) * size + 2;

/** A text in lines of at most `width`, at most `max`; the last one cut with "…". */
export function wrapLabel(text: string, width: number, size = 13, max = MAX_LINES): string[] {
	const lines: string[] = [];
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const last = lines.at(-1);
		if (last !== undefined && textWidth(`${last} ${word}`, size) <= width)
			lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	const cut = (line: string) => {
		let short = line;
		while (short.length > 1 && textWidth(`${short}…`, size) > width) short = short.slice(0, -1);
		return `${short.trimEnd()}…`;
	};
	const kept = lines.slice(0, max).map((l) => (textWidth(l, size) <= width ? l : cut(l)));
	if (lines.length > max && !kept[max - 1].endsWith('…')) kept[max - 1] = cut(kept[max - 1]);
	return kept;
}

/** The radius of a group's disc by its count. */
const discRadius = (n: number): number => (n < 10 ? 10 : n < 30 ? 12 : n < 100 ? 15 : 18);

const widest = (lines: readonly string[], size = 13) =>
	Math.max(0, ...lines.map((l) => textWidth(l, size)));

function nodeBox(u: SceneUnit, x: number, y: number, room: number): UnitBox {
	const text = room - GLYPH - 8;
	const name = wrapLabel(u.label, text);
	const role = u.role ? wrapLabel(u.role, text, 11) : [];
	const gap = u.gap ? 2 * SMALL_LINE : 0;
	const height = Math.max(GLYPH, name.length * LINE + role.length * SMALL_LINE + gap);
	const width = Math.min(text, Math.max(widest(name), widest(role, 11)));
	const label = { x: x + GLYPH + 8, y, width, height };
	return {
		x,
		y,
		width: GLYPH + 8 + width,
		height,
		mark: { x, y, width: GLYPH, height: GLYPH },
		label,
		rows: [],
		text: { name, small: role }
	};
}

function groupBox(u: SceneUnit, x: number, y: number, room: number): UnitBox {
	const r = discRadius(u.members.length);
	const text = room - 2 * r - 8;
	const name = wrapLabel(u.label, text);
	const small = u.breakdown ? wrapLabel(u.breakdown, text, 12) : [];
	const lines = [...name, ...small];
	const height = Math.max(2 * r, lines.length * SMALL_LINE + 2);
	const width = Math.min(text, widest(lines));
	const label = { x: x + 2 * r + 8, y, width, height };
	return {
		x,
		y,
		width: 2 * r + 8 + width,
		height,
		mark: { x, y, width: 2 * r, height: 2 * r },
		label,
		rows: [],
		text: { name, small }
	};
}

/** A hull: its name in a pill, below it a rectangle with a line of members per row, a head where it has rows. */
function hullBox(u: SceneUnit, x: number, y: number, room: number): UnitBox {
	const perLine = Math.max(1, Math.floor((room - 32) / DOT));
	const headed = u.rows.length > 1 || u.rows.some((r) => r.label);
	const rows: UnitBox['rows'] = [];
	let cy = y + HULL_PILL + 16;
	let wide = 0;
	for (const row of u.rows) {
		if (headed) cy += ROW_HEAD;
		const shown = Math.min(row.members.length, 2 * perLine);
		rows.push({ id: row.id, y: cy + DOT_LINE / 2 });
		cy += Math.ceil(shown / perLine) * DOT_LINE;
		wide = Math.max(
			wide,
			Math.min(row.members.length, perLine) * DOT,
			headed ? textWidth(row.label, 12) + 24 : 0
		);
	}
	// The pill: one line, cut with "…" where the column ends; measured as a size larger, for its weight.
	const pill = wrapLabel(u.label, room - PILL_PAD, PILL_SIZE, 1);
	const named = Math.min(room, widest(pill, PILL_SIZE) + PILL_PAD);
	const markWidth = Math.min(room, Math.max(32 + wide, 80));
	const mark = { x, y: y + HULL_PILL, width: markWidth, height: cy + 8 - (y + HULL_PILL) };
	const label = { x, y, width: named, height: HULL_PILL - 4 };
	const width = Math.max(markWidth, named);
	const text = { name: pill, small: [] };
	return { x, y, width, height: mark.y + mark.height - y, mark, label, rows, text };
}

const boxOf = (u: SceneUnit, x: number, y: number, room: number): UnitBox =>
	u.shape === 'hull'
		? hullBox(u, x, y, room)
		: u.shape === 'group'
			? groupBox(u, x, y, room)
			: nodeBox(u, x, y, room);

const SHAPE_RANK = { hull: 0, node: 1, group: 2 } as const;

/** The order in a column when nothing else decides: chosen first, hulls, bronnen, groups, by name. */
const byDefault = (a: SceneUnit, b: SceneUnit) =>
	Number(b.focus) - Number(a.focus) ||
	SHAPE_RANK[a.shape] - SHAPE_RANK[b.shape] ||
	a.label.localeCompare(b.label) ||
	a.id.localeCompare(b.id);

/** Where a column's units stand; `inner`: its own rails' room right of them. */
type Frame = { x: number; width: number; inner?: number };

/** The rails a gutter takes at least this far apart, so no two lines run on one another. */
const RAIL_MIN = 9;
/** A gutter never grows past this: beyond it, its rails stand closer. */
const GUTTER_MAX = 360;

/**
 * How many rails each gutter holds, after the column of that index: a line runs down the gutter
 * before its target's column (and, past a column between, the one after its own), a line within a
 * column down the gutter right of it. A bundle (one target or one bron, one lijnsoort) is one rail.
 */
function gutterLoads(scene: Scene, used: readonly Column[]): number[] {
	const general = new Set(scene.units.filter((u) => u.general).map((u) => u.id));
	const index = new Map(scene.units.map((u) => [u.id, used.indexOf(u.column)]));
	const rails = scene.lines.flatMap((l) => {
		const [a, b] = [index.get(l.from)!, index.get(l.to)!];
		const strip = general.has(l.from) || general.has(l.to);
		return guttersOf(a, b, general.has(l.from), general.has(l.to))
			.filter((g) => g >= 0 && g < used.length)
			.map((g) => ({ g, strip, l }));
	});
	// As lane-lines bundles them: on the end where more of one lijnsoort meet.
	const count = new Map<string, number>();
	const keysOf = (g: number, l: SceneLine) => [
		`${g} to ${l.to} ${l.kind}`,
		`${g} from ${l.from} ${l.kind}`
	];
	for (const { g, l } of rails) for (const k of keysOf(g, l)) count.set(k, (count.get(k) ?? 0) + 1);
	const keys = used.map(() => new Set<string>());
	for (const { g, strip, l } of rails) {
		const [into, outOf] = keysOf(g, l);
		keys[g].add(strip ? l.id : (count.get(outOf) ?? 0) > (count.get(into) ?? 0) ? outOf : into);
	}
	return keys.map((k) => k.size);
}

/** The gutters a line between columns `a` and `b` runs down; to the strip, on either side of its column. */
function guttersOf(a: number, b: number, fromStrip: boolean, toStrip: boolean): number[] {
	if (fromStrip && toStrip) return [];
	if (fromStrip || toStrip) {
		const k = fromStrip ? b : a;
		return [k - 1, k];
	}
	if (a === b) return [];
	return a < b ? [b - 1, ...(b - a > 1 ? [a] : [])] : [b, ...(a - b > 1 ? [a - 1] : [])];
}

/**
 * The rails of each column's own lines (a wet that names a wet), inside its panel: one per target and
 * lijnsoort, as lane-lines bundles them.
 */
function innerLoads(scene: Scene, used: readonly Column[]): number[] {
	const general = new Set(scene.units.filter((u) => u.general).map((u) => u.id));
	const column = new Map(scene.units.map((u) => [u.id, used.indexOf(u.column)]));
	const keys = used.map(() => new Set<string>());
	for (const l of scene.lines) {
		const a = column.get(l.from)!;
		if (a === column.get(l.to) && !general.has(l.from) && !general.has(l.to))
			keys[a].add(`${l.to} ${l.kind}`);
	}
	return keys.map((k) => (k.size > 0 ? 12 + k.size * RAIL_MIN : 0));
}

/** The width a gutter needs for `rails` rails, between the panels on either side. */
const gutterFor = (rails: number) =>
	Math.min(GUTTER_MAX, Math.max(GUTTER, Math.ceil(2 * PANEL + 12 + rails * RAIL_MIN)));

/**
 * The x and width of each column that holds a unit, the rest of the width to Wetten; and the width
 * the canvas takes: `width`, or more where its columns and gutters need it.
 */
function framesOf(
	scene: Scene,
	width: number,
	timed: boolean
): { frames: Map<Column, Frame>; width: number } {
	const used = COLUMN_ORDER.filter((c) => scene.units.some((u) => u.column === c && !u.general));
	const left = timed ? MARGIN_LEFT_TIMED : MARGIN_LEFT;
	const gutters = gutterLoads(scene, used).map(gutterFor);
	const inner = innerLoads(scene, used);
	const fixed = used.reduce((n, c, i) => n + (FIXED_WIDTH[c] ?? 0) + inner[i], 0);
	const between = gutters.slice(0, -1).reduce((n, g) => n + g, 0);
	const right = Math.max(MARGIN_RIGHT, (gutters.at(-1) ?? 0) / 2 + 8);
	const laws = Math.max(LAWS_MIN, width - left - right - fixed - between);
	const frames = new Map<Column, Frame>();
	let x = left;
	used.forEach((c, i) => {
		const w = FIXED_WIDTH[c] ?? laws;
		frames.set(c, { x, width: w, inner: inner[i] });
		x += w + inner[i] + gutters[i];
	});
	const last = [...frames.values()].at(-1);
	const end = last ? Math.ceil(last.x + last.width + (last.inner ?? 0) + right) : 0;
	return { frames, width: Math.max(width, end) };
}

const PAIR_SPACE = 36;

/** Whether a dossier is small enough to stand beside another in Kamerstukken. */
const small = (u: SceneUnit, box: UnitBox, room: number) =>
	u.shape === 'hull' && !u.focus && box.width <= (room - PAIR_SPACE) / 2;

type Beside = { box: UnitBox; unit: SceneUnit };

/** The box of `u` beside the small dossier left of it, if both are small and it fits. */
function besideOf(left: Beside | null, u: SceneUnit, frame: Frame): UnitBox | null {
	if (!left || !small(left.unit, left.box, frame.width)) return null;
	const x = left.box.x + left.box.width + PAIR_SPACE;
	const box = boxOf(u, x, left.box.y, frame.x + frame.width - x);
	return small(u, box, frame.width) && box.x + box.width <= frame.x + frame.width ? box : null;
}

type Placed = { units: Map<string, UnitBox>; bottom: number };

/** The units of one column from `top` down, in their order; in Tijd by the axis (no pairs then). */
function placeColumn(
	units: readonly SceneUnit[],
	frame: Frame,
	top: number,
	axis: TimeAxis | null,
	need: ReadonlyMap<number, number> = new Map()
): Placed {
	const out = new Map<string, UnitBox>();
	let y = top;
	let left: Beside | null = null;
	for (const u of units) {
		const at = axis ? timedTop(axis, u.date, need) : null;
		if (at !== null) y = Math.max(y, at);
		const beside = axis ? null : besideOf(left, u, frame);
		if (beside) {
			out.set(u.id, beside);
			y = Math.max(y, beside.y + beside.height + HULL_GAP);
			left = null;
			continue;
		}
		const box = boxOf(u, frame.x, Math.ceil(y / 4) * 4, frame.width);
		out.set(u.id, box);
		left = u.column === 'papers' && u.shape === 'hull' ? { box, unit: u } : null;
		y = box.y + box.height + (u.shape === 'hull' ? HULL_GAP : ITEM_GAP);
	}
	return { units: out, bottom: y };
}

const gapOf = (u: SceneUnit) => (u.shape === 'hull' ? HULL_GAP : ITEM_GAP);

/**
 * In Tijd, what a column needs of each year: its units of that year one under the other. The axis
 * gives a year at least that much, so nothing is pushed into the next year.
 */
function yearNeeds(scene: Scene, frames: ReadonlyMap<Column, Frame>) {
	const needs = new Map<Column, Map<number, number>>();
	for (const u of scene.units) {
		const frame = frames.get(u.column);
		if (u.general || !u.date || !frame || (u.column !== 'papers' && u.column !== 'rulings'))
			continue;
		const year = Number(u.date.slice(0, 4));
		const own = needs.get(u.column) ?? new Map<number, number>();
		const height = boxOf(u, frame.x, 0, frame.width).height + gapOf(u) + 4;
		own.set(year, (own.get(year) ?? 0) + height);
		needs.set(u.column, own);
	}
	return needs;
}

/**
 * Where a unit of a column in Tijd starts: in its year, as far down as its day, but only as far as
 * the room the year has beyond what the column puts in it (`yearNeeds`).
 */
function timedTop(axis: TimeAxis, day: string | null, need: ReadonlyMap<number, number>) {
	const at = axisY(axis, day);
	if (at === null || !day) return at;
	const year = Number(day.slice(0, 4));
	const s = axis.segments.find((g) => !g.empty && year >= g.from && year < g.to);
	if (!s) return at;
	const slack = Math.max(0, s.height - (need.get(year) ?? 0));
	return s.y + Math.max(0, Math.min(1, yearFraction(day) - s.from)) * slack;
}

/** Wie maakt: a card per lane, in the order of MAKER_LANE_ORDER. */
function placeMakers(units: readonly SceneUnit[], frame: Frame, top: number) {
	const out = new Map<string, UnitBox>();
	const lanes: LaneLayout['lanes'] = [];
	let y = top;
	for (const lane of MAKER_LANE_ORDER) {
		const own = units.filter((u) => u.lane === lane);
		if (own.length === 0) continue;
		const placed = placeColumn(own, frame, y + LANE_HEAD, null);
		for (const [id, box] of placed.units) out.set(id, box);
		const bottom = placed.bottom - ITEM_GAP + 10;
		lanes.push({
			lane,
			x: frame.x - 6,
			y: y - 10,
			width: frame.width + 12,
			height: bottom - (y - 10)
		});
		y = bottom + LANE_SPACE;
	}
	return { units: out, lanes, bottom: y };
}

/**
 * The bands of the strip, each from a new line: the general wetten themselves, then what hangs on
 * them by column. The lines of the strip then rise from below into the wet they cite.
 */
function stripBands(units: readonly SceneUnit[]): SceneUnit[][] {
	const law = (u: SceneUnit) => u.column === 'laws' && u.shape !== 'group';
	const rest = COLUMN_ORDER.map((c) => units.filter((u) => !law(u) && u.column === c));
	return [units.filter(law), ...rest].filter((band) => band.length > 0);
}

/** The strip Algemene wetten: its units side by side by band, a new line where the width ends. */
function placeStrip(units: readonly SceneUnit[], x0: number, right: number, top: number) {
	const out = new Map<string, UnitBox>();
	let y = top + STRIP_HEAD;
	let line = 0;
	for (const band of stripBands(units)) {
		let x = x0;
		if (line > 0) [y, line] = [y + line + ITEM_GAP, 0];
		for (const u of band) {
			let box = boxOf(u, x, y, Math.min(right - x0, 260));
			if (x > x0 && box.x + box.width > right) {
				[y, x, line] = [y + line + ITEM_GAP, x0, 0];
				box = boxOf(u, x, y, Math.min(right - x0, 260));
			}
			out.set(u.id, box);
			line = Math.max(line, box.height);
			x = box.x + box.width + 44;
		}
	}
	const strip = {
		x: x0 - PANEL,
		y: top,
		width: right - x0 + 2 * PANEL,
		height: y + line + 20 - top
	};
	return { units: out, strip };
}

/** The mean height of a unit's partners already placed: the order that crosses fewest lines. */
function barycentre(scene: Scene, placed: ReadonlyMap<string, UnitBox>): Map<string, number> {
	const sum = new Map<string, [number, number]>();
	for (const l of scene.lines)
		for (const [self, other] of [
			[l.from, l.to],
			[l.to, l.from]
		]) {
			const box = placed.get(other);
			if (!box) continue;
			const [s, n] = sum.get(self) ?? [0, 0];
			sum.set(self, [s + box.y + box.height / 2, n + 1]);
		}
	return new Map([...sum].map(([id, [s, n]]) => [id, s / n]));
}

/** The order of a column: in Tijd by date; else chosen first, then by where its partners stand. */
function ordered(units: SceneUnit[], centre: ReadonlyMap<string, number> | null, timed: boolean) {
	if (timed)
		return units.sort(
			(a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || byDefault(a, b)
		);
	const at = (u: SceneUnit) => (u.focus ? -Infinity : (centre?.get(u.id) ?? Infinity));
	return units.sort((a, b) => at(a) - at(b) || byDefault(a, b));
}

function placeAll(
	scene: Scene,
	frames: Map<Column, Frame>,
	axis: TimeAxis | null,
	centre: Map<string, number> | null,
	needs: ReadonlyMap<Column, Map<number, number>>
) {
	const units = new Map<string, UnitBox>();
	const bottoms: number[] = [];
	let lanes: LaneLayout['lanes'] = [];
	for (const [column, frame] of frames) {
		const own = scene.units.filter((u) => u.column === column && !u.general);
		const timed = !!axis && (column === 'papers' || column === 'rulings');
		const list = ordered(own, centre, timed);
		const placed =
			column === 'makers'
				? placeMakers(list, frame, CONTENT_TOP)
				: placeColumn(list, frame, CONTENT_TOP, timed ? axis : null, needs.get(column));
		if (column === 'makers') lanes = (placed as ReturnType<typeof placeMakers>).lanes;
		for (const [id, box] of placed.units) units.set(id, box);
		bottoms.push(placed.bottom);
	}
	return { units, lanes, bottom: Math.max(CONTENT_TOP, ...bottoms) };
}

/**
 * The layout of a scene on a canvas `width` px wide, with Tijd on or off. Two passes: the second
 * orders each column by where the partners of its units stood in the first.
 */
export function laneLayout(scene: Scene, width: number, time = false): LaneLayout {
	const framed = framesOf(scene, width, time);
	const frames = framed.frames;
	width = framed.width;
	const dated = scene.units.filter(
		(u) => !u.general && (u.column === 'papers' || u.column === 'rulings')
	);
	const needs = yearNeeds(scene, frames);
	const most = (year: number) => Math.max(0, ...[...needs.values()].map((n) => n.get(year) ?? 0));
	const axis = time
		? timeAxis(
				dated.map((u) => u.date),
				CONTENT_TOP + 14,
				most
			)
		: null;
	const first = placeAll(scene, frames, axis, null, needs);
	const { units, lanes, bottom } = placeAll(
		scene,
		frames,
		axis,
		barycentre(scene, first.units),
		needs
	);
	const general = scene.units.filter((u) => u.general).sort(byDefault);
	let strip: Box | null = null;
	let end = bottom;
	if (general.length > 0) {
		const from = frames.get('papers') ?? [...frames.values()][0] ?? { x: MARGIN_LEFT, width: 0 };
		const placed = placeStrip(general, from.x, width - MARGIN_RIGHT - PANEL, bottom + STRIP_SPACE);
		for (const [id, box] of placed.units) units.set(id, box);
		strip = placed.strip;
		end = strip.y + strip.height;
	}
	const columns = [...frames].map(([column, f]) => ({
		column,
		x: f.x,
		width: f.width + (f.inner ?? 0),
		inner: f.inner ?? 0,
		y: CONTENT_TOP,
		height: bottom - CONTENT_TOP
	}));
	return { width, height: Math.ceil(end + 40), columns, lanes, strip, units, axis };
}
