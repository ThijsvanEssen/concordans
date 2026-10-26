// The network of one bron as Verbonden draws it on request (Netwerk tonen, besluit 32): the
// bron in the middle, its verbindingen around it. Up to SKETCH_LIMIT bronnen each stands on
// its own; beyond that a group stands as one bron with its count, per instantie where the
// API counts them (a judgment's court), so the drawing stays readable. Pure: the layout in
// the coordinates of the drawing, which NetworkSketch renders. A name is never cut: it
// wraps over lines, and a name that would cover another, or a circle, is left to its title.
import { refId } from '$lib/bron/href';
import type { BronRef } from '$lib/bron/ref';
import { vormVanBron } from '$lib/bron/vormen';
import type { Collection } from '$lib/vocabulary';
import type { TierCount } from './tiers';
import type { Row } from './rows';

/** The most bronnen drawn: more and a group becomes one bron with its count (besluit 32). */
export const SKETCH_LIMIT = 40;
/** On a phone, a dozen: the drawing is narrow. */
export const PHONE_SKETCH_LIMIT = 12;
/** The longest line of a name: a longer name wraps at its words. */
export const LABEL_MAX = 24;
/** The longest line of a circle's name, under the circle. */
const CIRCLE_LINE = 14;
/** The height of a line of a name. */
export const LINE_H = 14;

export const WIDTH = 360;
const R_SINGLE = 118;
const R_CLUSTER = 128;
const MARGIN = 16;
/** The width of a character of a name at 12 px, to keep a name inside the drawing. */
const CHAR_WIDTH = 7;

export type SketchGroup = {
	id: string;
	/** What its circle is called: `Uitspraken`, `Overige instanties`. */
	name: string;
	/** The kind of most of its bronnen, for its colour. */
	collection: Collection | null;
	/** The soort that has a colour of its own besides its collection's (the regulations). */
	hue?: string | null;
	count: number;
	rows: Row[];
	/** The API cut the group off: its rows are not all there is, so it stands as one. */
	capped?: boolean;
	/** Its parts as the API counts them (instanties), else none. */
	parts?: readonly Pick<TierCount, 'tier' | 'label' | 'count'>[] | null;
};

type Single = {
	id: string;
	ref: BronRef;
	title: string;
	/** Its row of Verbonden: a click opens it in place under the drawing. */
	row: Row;
	/** Its name over lines; null where it would cover another (its title names it). */
	lines: string[] | null;
	shape: ReturnType<typeof vormVanBron>;
	collection: Collection;
	hue: string | null;
	x: number;
	y: number;
	/** Where the middle of its name's first line stands. */
	lx: number;
	ly: number;
	/** Half the room to its neighbours: the radius a finger may tap. */
	hit: number;
};

type Circle = {
	id: string;
	/** The group of Verbonden it stands for. */
	group: string;
	count: number;
	label: string;
	/** Its name over lines, under the circle; `lx` keeps them inside the drawing. */
	lines: string[];
	lx: number;
	/** The baseline of its name's first line: under the circle, above it where under it
	 *  would cover a name before it. */
	ly: number;
	collection: Collection | null;
	hue: string | null;
	x: number;
	y: number;
	r: number;
};

export type Sketch = {
	singles: Single[];
	clusters: Circle[];
	/** The bronnen in the groups together. */
	inClusters: number;
	center: { x: number; y: number };
	/** The name of the bron in the middle, over lines. */
	centerLines: string[];
	height: number;
};

/** A circle's radius by its count: 132 is some 21, 6.507 some 31. */
const radius = (count: number): number =>
	Math.min(32, Math.max(14, 8 + 6 * Math.log10(Math.max(count, 1))));

/** The width of the line to a group: thicker with more bronnen behind it. */
export const clusterLine = (count: number): number => 1.5 + 0.4 * Math.log10(Math.max(count, 1));

/** `n` angles spread over [from, to] (degrees), at the middle where there is one. */
function angles(n: number, from: number, to: number): number[] {
	if (n === 0) return [];
	if (n === 1) return [(from + to) / 2];
	return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

/** All around, from the top, for a drawing of one kind of node only. */
const around = (n: number) => Array.from({ length: n }, (_, i) => -90 + (360 * i) / n);

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Which bronnen stand on their own and which groups become one bron, before the layout. */
export function divide(
	groups: readonly SketchGroup[],
	limit = SKETCH_LIMIT
): {
	singles: { row: Row; hue: string | null }[];
	clusters: Omit<Circle, 'x' | 'y' | 'r' | 'lines' | 'lx' | 'ly'>[];
} {
	const withCount = groups.filter((g) => g.count > 0);
	const smallestFirst = [...withCount].sort((a, b) => a.count - b.count);
	const singles: { row: Row; hue: string | null }[] = [];
	const seen = new Set<string>();
	const clusters: Omit<Circle, 'x' | 'y' | 'r' | 'lines' | 'lx' | 'ly'>[] = [];
	let room = limit;
	smallestFirst.forEach((g, i) => {
		const toGo = smallestFirst.length - 1 - i;
		const whole = !g.capped && g.rows.length >= g.count;
		if (whole && g.count <= room - toGo) {
			for (const row of g.rows) {
				const id = refId(row.ref);
				if (seen.has(id)) continue;
				seen.add(id);
				singles.push({ row, hue: g.hue ?? null });
			}
			room -= g.count;
			return;
		}
		const own = g.parts?.length
			? g.parts.map((d) => ({ id: `${g.id}:${d.tier ?? 'other'}`, label: d.label, count: d.count }))
			: [{ id: g.id, label: g.name, count: g.count }];
		for (const p of own)
			clusters.push({ ...p, group: g.id, collection: g.collection, hue: g.hue ?? null });
		room -= own.length;
	});
	// In the order of the panel, not by size.
	const place = new Map(withCount.map((g, i) => [g.id, i]));
	clusters.sort((a, b) => (place.get(a.group) ?? 0) - (place.get(b.group) ?? 0));
	return { singles, clusters };
}

/** A name over lines of at most `max` characters, broken at its words; a word longer stays whole. */
export function wrap(name: string, max: number): string[] {
	const lines: string[] = [];
	for (const word of name.split(/\s+/).filter(Boolean)) {
		const last = lines.at(-1);
		if (last != null && last.length + 1 + word.length <= max)
			lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	return lines;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const widthOf = (lines: string[]) => Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH;
/** The middle of a name kept inside the drawing. */
const inside = (x: number, lines: string[]) => {
	const half = widthOf(lines) / 2;
	return Math.min(WIDTH - 4 - half, Math.max(4 + half, x));
};
/** The box of a name whose first line stands at `y` (its baseline). */
const boxOf = (x: number, y: number, lines: string[]): Box => {
	const half = widthOf(lines) / 2;
	return {
		x0: x - half - 2,
		y0: y - 11,
		x1: x + half + 2,
		y1: y + (lines.length - 1) * LINE_H + 4
	};
};

/** The layout: the single bronnen over the top, the groups under the bron. */
export function sketch(
	groups: readonly SketchGroup[],
	centerName = '',
	limit = SKETCH_LIMIT
): Sketch {
	const { singles: single, clusters: clu } = divide(groups, limit);
	const cx = WIDTH / 2;
	const both = single.length > 0 && clu.length > 0;
	const singleAngles = both ? angles(single.length, -150, -30) : around(single.length);
	const clusterAngles = both ? angles(clu.length, 20, 160) : around(clu.length);
	const step = single.length > 1 ? (rad(both ? 120 : 360) * R_SINGLE) / single.length : 2 * 22;

	const clusters: Circle[] = clu.map((b, i) => {
		const a = rad(clusterAngles[i]);
		const x = cx + R_CLUSTER * Math.cos(a);
		const lines = wrap(b.label, CIRCLE_LINE);
		const y = R_CLUSTER * Math.sin(a);
		const r = radius(b.count);
		return { ...b, lines, lx: inside(x, lines), ly: y + r + 16, x, y, r };
	});
	// A circle's name never lies over another's: under its circle where that is free, else
	// above it, else none (its title and the list name it).
	const names: Box[] = clusters.map((b) => ({
		x0: b.x - b.r,
		y0: b.y - b.r,
		x1: b.x + b.r,
		y1: b.y + b.r
	}));
	for (const b of clusters) {
		const under = boxOf(b.lx, b.ly, b.lines);
		const above = boxOf(b.lx, b.y - b.r - 8 - (b.lines.length - 1) * LINE_H, b.lines);
		const free = (box: Box) => !names.some((t) => overlaps(t, box));
		if (free(under)) names.push(under);
		else if (free(above)) {
			b.ly = above.y0 + 11;
			names.push(above);
		} else b.lines = [];
	}
	const centerLines = wrap(centerName, LABEL_MAX);
	// What a name may not cover: the circles with their names, the bron in the middle with its.
	const taken: Box[] = [
		...clusters.flatMap((b) => [
			{ x0: b.x - b.r, y0: b.y - b.r, x1: b.x + b.r, y1: b.y + b.r },
			boxOf(b.lx, b.ly, b.lines)
		]),
		{ x0: cx - 18, y0: -18, x1: cx + 18, y1: 18 },
		...(centerName ? [boxOf(cx, 34, centerLines)] : [])
	];

	const singles: Single[] = single.map(({ row, hue }, i) => {
		const a = rad(singleAngles[i]);
		const sin = Math.sin(a);
		const x = cx + R_SINGLE * Math.cos(a);
		const y = R_SINGLE * sin;
		const lines = wrap(row.title, LABEL_MAX);
		// Above a node over the bron, under one beside or below it.
		const ly = sin < -0.6 ? y - 12 - (lines.length - 1) * LINE_H : y + 20;
		return {
			id: refId(row.ref),
			ref: row.ref,
			title: row.title,
			row,
			lines,
			shape: vormVanBron(row.ref.collection, row.props, row.ref.key),
			collection: row.ref.collection,
			hue,
			x,
			y,
			lx: inside(x, lines),
			ly,
			hit: Math.min(22, step / 2)
		};
	});
	for (const l of singles) taken.push({ x0: l.x - 7, y0: l.y - 7, x1: l.x + 7, y1: l.y + 7 });
	// The names in the order of their place to read: the outer ones first, then from the middle
	// out; each one only where it covers nothing named before it.
	const order = singles
		.map((l, i) => ({ l, i }))
		.sort((p, q) => rank(p.i, singles.length) - rank(q.i, singles.length));
	for (const { l } of order) {
		const box = boxOf(l.lx, l.ly, l.lines!);
		if (taken.some((t) => overlaps(t, box))) l.lines = null;
		else taken.push(box);
	}

	// From the top of the highest name to the foot of the lowest.
	const top = Math.min(
		-28,
		...singles.filter((l) => l.lines).map((l) => l.ly - 14),
		...singles.map((l) => l.y - 10),
		...clusters.map((b) => b.y - b.r - 4),
		...clusters.filter((b) => b.ly < b.y).map((b) => b.ly - 14)
	);
	const foot = Math.max(
		34 + centerLines.length * LINE_H,
		...singles.map((l) => (l.lines ? l.ly + (l.lines.length - 1) * LINE_H + 6 : l.y + 10)),
		...clusters.map((b) => b.y + b.r + 22 + (b.lines.length - 1) * LINE_H)
	);
	const dy = MARGIN - top;
	for (const l of singles) {
		l.y += dy;
		l.ly += dy;
	}
	for (const b of clusters) {
		b.y += dy;
		b.ly += dy;
	}
	return {
		singles,
		clusters,
		inClusters: clusters.reduce((sum, b) => sum + b.count, 0),
		center: { x: cx, y: dy },
		centerLines,
		height: Math.ceil(foot + dy + MARGIN)
	};
}

/** The first and the last name first, then from the middle outwards. */
function rank(i: number, n: number): number {
	if (i === 0 || i === n - 1) return -1;
	return Math.abs(i - (n - 1) / 2);
}
