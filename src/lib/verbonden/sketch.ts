// The network of one bron as Verbonden draws it on request (Netwerk tonen, besluit 32): the
// bron in the middle, its verbindingen around it. Up to SKETCH_LIMIT bronnen each stands on
// its own; beyond that a group stands as one bron with its count, per instantie where the
// API counts them (a judgment's court), so the drawing stays readable. Pure: the layout in
// the coordinates of the drawing, which NetwerkSchets renders.
import { kort } from '$lib/graph/types';
import { refId, type BronRef } from '$lib/bron/href';
import { vormVanBron } from '$lib/bron/vormen';
import type { Collection } from '$lib/vocabulary';
import type { TierCount } from './tiers';
import type { Row } from './rows';

/** The most bronnen drawn: more and a group becomes one bron with its count (besluit 32). */
export const SKETCH_LIMIT = 40;
/** The longest name on the drawing: its citeertitel or abbreviation, else cut with "…". */
export const LABEL_MAX = 24;
/** Up to so many bronnen on their own all carry their name; more, the first, middle and last. */
const ALL_NAMED = 12;

export const WIDTH = 360;
const R_SINGLE = 118;
const R_CLUSTER = 128;
const MARGIN = 16;
/** The width of a character of a name at 12 px, to keep a name inside the drawing. */
const CHAR_WIDTH = 6.2;

export type SketchGroup = {
	id: string;
	/** What its circle is called: `Uitspraken`, `Stukken, Eerste Kamer` (at most LABEL_MAX). */
	name: string;
	/** The kind of most of its bronnen, for its colour. */
	collection: Collection | null;
	count: number;
	rows: Row[];
	/** The API cut the group off: its rows are not all there is, so it stands as one. */
	capped?: boolean;
	/** Its parts as the API counts them (instanties), else none. */
	parts?: readonly TierCount[] | null;
};

type Single = {
	id: string;
	ref: BronRef;
	title: string;
	label: string | null;
	shape: ReturnType<typeof vormVanBron>;
	collection: Collection;
	x: number;
	y: number;
	/** Where the middle of its name stands. */
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
	collection: Collection | null;
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
): { singles: { row: Row }[]; clusters: Omit<Circle, 'x' | 'y' | 'r'>[] } {
	const withCount = groups.filter((g) => g.count > 0);
	const smallestFirst = [...withCount].sort((a, b) => a.count - b.count);
	const singles: { row: Row }[] = [];
	const seen = new Set<string>();
	const clusters: Omit<Circle, 'x' | 'y' | 'r'>[] = [];
	let room = limit;
	smallestFirst.forEach((g, i) => {
		const toGo = smallestFirst.length - 1 - i;
		const whole = !g.capped && g.rows.length >= g.count;
		if (whole && g.count <= room - toGo) {
			for (const row of g.rows) {
				const id = refId(row.ref);
				if (seen.has(id)) continue;
				seen.add(id);
				singles.push({ row });
			}
			room -= g.count;
			return;
		}
		const own = g.parts?.length
			? g.parts.map((d) => ({ id: `${g.id}:${d.tier ?? 'other'}`, label: d.label, count: d.count }))
			: [{ id: g.id, label: g.name, count: g.count }];
		for (const p of own) clusters.push({ ...p, group: g.id, collection: g.collection });
		room -= own.length;
	});
	// In the order of the panel, not by size.
	const place = new Map(withCount.map((g, i) => [g.id, i]));
	clusters.sort((a, b) => (place.get(a.group) ?? 0) - (place.get(b.group) ?? 0));
	return { singles, clusters };
}

/** The layout: the single bronnen over the top, the groups under the bron. */
export function sketch(groups: readonly SketchGroup[], limit = SKETCH_LIMIT): Sketch {
	const { singles: single, clusters: clu } = divide(groups, limit);
	const cx = WIDTH / 2;
	const both = single.length > 0 && clu.length > 0;
	const singleAngles = both ? angles(single.length, -150, -30) : around(single.length);
	const clusterAngles = both ? angles(clu.length, 20, 160) : around(clu.length);
	const named = (i: number) =>
		single.length <= ALL_NAMED ||
		i === 0 ||
		i === single.length - 1 ||
		i === Math.floor((single.length - 1) / 2);
	const step = single.length > 1 ? (rad(both ? 120 : 360) * R_SINGLE) / single.length : 2 * 22;

	const singles: Single[] = single.map(({ row }, i) => {
		const a = rad(singleAngles[i]);
		const cos = Math.cos(a);
		const sin = Math.sin(a);
		const collection = row.ref.collection;
		const label = named(i) ? kort(row.title, LABEL_MAX) : null;
		// Above a node over the bron, under one beside or below it; centred on it, kept inside
		// the drawing by its estimated width.
		const x = cx + R_SINGLE * cos;
		const half = label ? (label.length * CHAR_WIDTH) / 2 : 0;
		return {
			id: refId(row.ref),
			ref: row.ref,
			title: row.title,
			label,
			shape: vormVanBron(collection, row.props, row.ref.key),
			collection,
			x,
			y: R_SINGLE * sin,
			lx: Math.min(WIDTH - 4 - half, Math.max(4 + half, x)),
			ly: R_SINGLE * sin + (sin < -0.6 ? -12 : 20),
			hit: Math.min(22, step / 2)
		};
	});
	const clusters: Circle[] = clu.map((b, i) => {
		const a = rad(clusterAngles[i]);
		return {
			...b,
			x: cx + R_CLUSTER * Math.cos(a),
			y: R_CLUSTER * Math.sin(a),
			r: radius(b.count)
		};
	});

	// From the top of the highest name to the foot of the lowest label.
	const top = Math.min(
		-28,
		...singles.map((l) => l.ly - 14),
		...clusters.map((b) => b.y - b.r - 4)
	);
	const foot = Math.max(
		40,
		...singles.map((l) => l.ly + 6),
		...clusters.map((b) => b.y + b.r + 34)
	);
	const dy = MARGIN - top;
	for (const l of singles) {
		l.y += dy;
		l.ly += dy;
	}
	for (const b of clusters) b.y += dy;
	return {
		singles,
		clusters,
		inClusters: clusters.reduce((sum, b) => sum + b.count, 0),
		center: { x: cx, y: dy },
		height: Math.ceil(foot + dy + MARGIN)
	};
}
