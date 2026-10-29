// The network of one bron as Verbonden draws it on request (Netwerk tonen, besluit 32): the
// bron in the middle, its verbindingen around it. Up to SKETCH_LIMIT bronnen each stands on
// its own; beyond that a group stands as one bron with its count, per instantie where the
// API counts them (a judgment's court), so the drawing stays readable. Pure: the layout in
// the coordinates of the drawing, which NetworkSketch renders. A name is never cut: it
// wraps over lines, and a name that would cover another, or a circle, is left to its title.
import { refId } from '$lib/bron/href';
import type { BronRef } from '$lib/bron/ref';
import { vormVanBron } from '$lib/bron/vormen';
import { drawClassOf, type DrawClass } from '$lib/graph/types';
import { holdsInHull, type ContainerKind } from '$lib/graph/container-membership';
import { hullOutline } from '$lib/graph/hull';
import { HULL, NODE } from '$lib/graph/draw-spec';
import { plural } from '$lib/text/words';
import { formatCount } from '$lib/text/getal';
import { bronPlural, type Collection, type Relation } from '$lib/vocabulary';
import type { TierCount } from './tiers';
import type { Row } from './rows';

/** The most bronnen drawn: more and a group becomes one bron with its count (besluit 32). */
export const SKETCH_LIMIT = 40;
/** On a phone, a dozen: the drawing is narrow. */
export const PHONE_SKETCH_LIMIT = 12;
/** The longest line of a name: a longer name wraps at its words. */
export const LABEL_MAX = 22;
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
	/** The kind that has a colour of its own besides its collection's (the regulations). */
	hue?: string | null;
	count: number;
	rows: Row[];
	/** The API cut the group off: its rows are not all there is, so it stands as one. */
	capped?: boolean;
	/** Its parts as the API counts them (instanties), else none. */
	parts?: readonly Pick<TierCount, 'tier' | 'label' | 'count'>[] | null;
};

/** How a line of the drawing runs: its relation, whom it comes from, and to whom it points. */
export type SketchLine = {
	relation: Relation | null;
	/** `inbound`: the other bron names the one in the middle; `outbound`: the other way. */
	direction: 'inbound' | 'outbound' | null;
	/** The kind of the bron the line comes from: a citation by an article is structural. */
	source: DrawClass;
};

type Single = SketchLine & {
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
	/** The hull it stands in (`centre`, or a dossier's), else null. */
	hull: string | null;
	/** It stands in a hull: its own line is the hull's, not a line of its own. */
	joined: boolean;
};

type Circle = SketchLine & {
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
	hull: string | null;
	joined: boolean;
};

/** A hull as the canvas draws it: a disc round its members with its name in a pill above. */
type SketchHull = {
	id: string;
	kind: ContainerKind;
	/** Its name in the pill, short; `title` in full. */
	label: string;
	title: string;
	x: number;
	y: number;
	r: number;
	/** The pill: centred on `x`, its bottom at `y`. */
	pill: { x: number; y: number; w: number };
	/** The bron in the middle itself: the lines of the others begin at its rim. */
	centre: boolean;
	/** A dossier among the neighbours: the one line into it, else null. */
	line: SketchLine | null;
};

/** What the layout draws as a hull besides the groups: the bron in the middle, its law. */
type SketchContext = {
	/** The bron in the middle, for its vorm (default: a square). */
	centre?: { collection: Collection; key: string; props?: Record<string, unknown> };
	/** The kind of hull the bron in the middle is, where it is a container (wet, dossier, fractie, commissie, kabinet). */
	centreKind?: ContainerKind | null;
	/** The short name of the law an article stands in (`BW`): the article is drawn in its hull. */
	home?: string | null;
};

export type Sketch = {
	/** The vorm of the bron in the middle. */
	shape: ReturnType<typeof vormVanBron>;
	singles: Single[];
	clusters: Circle[];
	hulls: SketchHull[];
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

/** The width of a line in the drawing: 0.8 of the canvas's (Netwerkschets, Maten). */
export const SKETCH_LINE = 0.8;

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
	clusters: Omit<Circle, 'x' | 'y' | 'r' | 'lines' | 'lx' | 'ly' | 'source' | 'hull' | 'joined'>[];
} {
	const withCount = groups.filter((g) => g.count > 0);
	const smallestFirst = [...withCount].sort((a, b) => a.count - b.count);
	const singles: { row: Row; hue: string | null }[] = [];
	const seen = new Set<string>();
	const clusters: Omit<
		Circle,
		'x' | 'y' | 'r' | 'lines' | 'lx' | 'ly' | 'source' | 'hull' | 'joined'
	>[] = [];
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
		const line = g.rows.find((r) => r.relation);
		for (const p of own)
			clusters.push({
				...p,
				group: g.id,
				collection: g.collection,
				hue: g.hue ?? null,
				relation: line?.relation ?? null,
				direction: line?.direction ?? null
			});
		room -= own.length;
	});
	// In the order of the panel, not by size.
	const place = new Map(withCount.map((g, i) => [g.id, i]));
	clusters.sort((a, b) => (place.get(a.group) ?? 0) - (place.get(b.group) ?? 0));
	return { singles, clusters };
}

const breek = (word: string, max: number): string[] => {
	if (word.length <= max) return [word];
	const parts: string[] = [];
	let rest = word;
	while (rest.length > max) {
		parts.push(`${rest.slice(0, max - 1)}-`);
		rest = rest.slice(max - 1);
	}
	return [...parts, rest];
};

/** A name over lines of at most `max` characters, broken at its words; a word longer than a line breaks with a hyphen. */
export function wrap(name: string, max: number): string[] {
	const lines: string[] = [];
	for (const word of name
		.split(/\s+/)
		.filter(Boolean)
		.flatMap((w) => breek(w, max))) {
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

/** The most bronnen that stand together in one hull; beyond that a soort is a cluster inside it. */
const HULL_MEMBERS_MAX = 8;

/** The dossiers a row says it belongs to (`dossier_number`, `dossier_numbers` of its props). */
function dossierKeysOf(row: Row): string[] {
	const p = row.props ?? {};
	const list = Array.isArray(p.dossier_numbers) ? (p.dossier_numbers as unknown[]) : [];
	return [p.dossier_number, ...list].filter((n): n is string => typeof n === 'string');
}

/** The room of a hull's members round its middle, and the hull's radius (Netwerkcanvas, Omhulling). */
function blobOf(sizes: number[]): { pos: { x: number; y: number }[]; r: number } {
	const biggest = Math.max(...sizes);
	if (sizes.length === 1) return { pos: [{ x: 0, y: 0 }], r: biggest + HULL.margin };
	const ring = Math.max(
		sizes.reduce((sum, s) => sum + 2 * s + 10, 0) / (2 * Math.PI),
		biggest + 12
	);
	return {
		pos: sizes.map((_, i) => {
			const a = rad(-90 + (360 * i) / sizes.length);
			return { x: ring * Math.cos(a), y: ring * Math.sin(a) };
		}),
		r: ring + biggest + HULL.margin
	};
}

/** The pill of a hull's name, centred above its disc. */
function pillOf(label: string, x: number, y: number, r: number) {
	return { x, y: y - r - HULL.labelGap, w: Math.ceil(label.length * PILL_CHAR + 2 * 8 + 2) };
}
const PILL_CHAR = 7.2;
/** Round the name of an article the hull keeps this much from its corners (the ring is 118). */
const HOME_MARGIN = 4;
const shorten = (name: string) => (name.length > 30 ? `${name.slice(0, 29)}…` : name);

/** A name box that cuts the rim of a disc: partly in it, partly out. */
function cutsRim(box: Box, d: { x: number; y: number; r: number }): boolean {
	const nearX = Math.max(box.x0, Math.min(d.x, box.x1));
	const nearY = Math.max(box.y0, Math.min(d.y, box.y1));
	if (Math.hypot(nearX - d.x, nearY - d.y) >= d.r) return false;
	const far = Math.max(
		...[box.x0, box.x1].flatMap((x) => [box.y0, box.y1].map((y) => Math.hypot(x - d.x, y - d.y)))
	);
	return far > d.r;
}

/**
 * The layout: the single bronnen over the top, the groups under the bron. What the canvas
 * draws as a hull is a hull here too (Netwerkcanvas, Omhulling): the bron in the middle when
 * it is a container with members (`context.centreKind`), the law of an article (`context.home`),
 * and a dossier of the bronnen with the stukken that name it in their props.
 */
export function sketch(
	groups: readonly SketchGroup[],
	centerName = '',
	limit = SKETCH_LIMIT,
	/** The kind of the bron in the middle, whom an outbound line comes from. */
	centerClass: DrawClass = 'article',
	context: SketchContext = {}
): Sketch {
	const centreKind = context.centreKind ?? null;
	const holds = (relation: Relation | null | undefined, direction: string | null | undefined) =>
		!!centreKind && holdsInHull(centreKind, relation, direction);
	// Past a hull's room a soort that stands in it is one cluster, inside it.
	const sized = groups.map((g) =>
		g.count > HULL_MEMBERS_MAX && g.rows.some((r) => holds(r.relation, r.direction))
			? { ...g, capped: true }
			: g
	);
	const { singles: single, clusters: clu } = divide(sized, limit);
	const cx = WIDTH / 2;

	const inCentreS = single.filter((s) => holds(s.row.relation, s.row.direction));
	const inCentreC = clu.filter((b) => holds(b.relation, b.direction));
	const hasCentre = inCentreS.length + inCentreC.length > 0;
	const looseS = single.filter((s) => !inCentreS.includes(s));
	const looseC = clu.filter((b) => !inCentreC.includes(b));

	// A dossier with the stukken that name it: one hull, the dossier itself is not a bron.
	const used = new Set<(typeof single)[number]>();
	const blobs = looseS
		.filter((s) => s.row.ref.collection === 'dossiers')
		.map((container) => {
			const members = looseS.filter(
				(m) =>
					m !== container &&
					!used.has(m) &&
					m.row.ref.collection !== 'dossiers' &&
					dossierKeysOf(m.row).includes(container.row.ref.key)
			);
			return { container, members };
		})
		.filter((b) => b.members.length > 0 && b.members.length <= HULL_MEMBERS_MAX)
		.map((b) => {
			b.members.forEach((m) => used.add(m));
			return b;
		});
	const asBlob = new Set([...blobs.map((b) => b.container), ...used]);
	const ringS = looseS.filter((s) => !asBlob.has(s));

	// The hull of the bron in the middle: its members round (cx, 0), the middle is the hull.
	const centreSizes = [
		...inCentreS.map(() => NODE.radius),
		...inCentreC.map((b) => radius(b.count))
	];
	const centreBlob = hasCentre ? blobOf(centreSizes) : null;
	const R_S = Math.max(R_SINGLE, (centreBlob?.r ?? 0) + 52);
	const R_C = Math.max(R_CLUSTER, (centreBlob?.r ?? 0) + 60);
	const slots = ringS.length + blobs.length;
	const both = slots > 0 && looseC.length > 0;
	const slotAngles = both ? angles(slots, -150, -30) : around(slots);
	const clusterAngles = both ? angles(looseC.length, 20, 160) : around(looseC.length);
	const step = slots > 1 ? (rad(both ? 120 : 360) * R_S) / slots : 2 * 22;

	const hulls: SketchHull[] = [];
	const lineOf = (row: Row | undefined): SketchLine => ({
		relation: row?.relation ?? null,
		direction: row?.direction ?? null,
		source:
			row?.direction === 'outbound' ? centerClass : drawClassOf(row?.ref.collection ?? 'documents')
	});

	const clusters: Circle[] = [];
	const makeCircle = (
		b: (typeof clu)[number],
		x: number,
		y: number,
		hull: string | null,
		withName: boolean
	): Circle => {
		const lines = wrap(b.label, CIRCLE_LINE);
		const r = radius(b.count);
		const source =
			b.direction === 'outbound' ? centerClass : drawClassOf(b.collection ?? 'documents');
		return {
			...b,
			source,
			lines: withName ? lines : [],
			lx: inside(x, lines),
			ly: y + r + 16,
			x,
			y,
			r,
			hull,
			joined: hull !== null
		};
	};
	looseC.forEach((b, i) => {
		const a = rad(clusterAngles[i]);
		clusters.push(makeCircle(b, cx + R_C * Math.cos(a), R_C * Math.sin(a), null, true));
	});
	inCentreC.forEach((b, i) => {
		const p = centreBlob!.pos[inCentreS.length + i];
		clusters.push(makeCircle(b, cx + p.x, p.y, 'centre', true));
	});

	if (centreBlob) {
		const label = shorten(centerName);
		hulls.push({
			id: 'centre',
			kind: centreKind!,
			label,
			title: centerName,
			x: cx,
			y: 0,
			r: centreBlob.r,
			pill: pillOf(label, cx, 0, centreBlob.r),
			centre: true,
			line: null
		});
	}

	// The names never lie over another's: under a circle where that is free, else above it,
	// else none (its title and the list name it).
	const names: Box[] = clusters.map((b) => ({
		x0: b.x - b.r,
		y0: b.y - b.r,
		x1: b.x + b.r,
		y1: b.y + b.r
	}));
	const centreBox = { x0: cx - 18, y0: -18, x1: cx + 18, y1: 18 };

	const singles: Single[] = [];
	const toSingle = (
		{ row, hue }: (typeof single)[number],
		x: number,
		y: number,
		ly: number,
		hull: string | null
	): Single => {
		const lines = wrap(row.title, LABEL_MAX);
		return {
			id: refId(row.ref),
			ref: row.ref,
			title: row.title,
			row,
			lines,
			shape: vormVanBron(row.ref.collection, row.props, row.ref.key),
			collection: row.ref.collection,
			hue,
			relation: row.relation ?? null,
			direction: row.direction ?? null,
			source: row.direction === 'outbound' ? centerClass : drawClassOf(row.ref.collection),
			x,
			y,
			lx: inside(x, lines),
			ly,
			hit: Math.min(22, step / 2),
			hull,
			joined: hull !== null
		};
	};
	const above = (sin: number, lines: string[], y: number) =>
		sin < -0.6 ? y - 12 - (lines.length - 1) * LINE_H : y + 20;

	inCentreS.forEach((s, i) => {
		const p = centreBlob!.pos[i];
		const y = p.y;
		const lines = wrap(s.row.title, LABEL_MAX);
		singles.push(
			toSingle(s, cx + p.x, y, above(Math.sin(Math.atan2(p.y, p.x)), lines, y), 'centre')
		);
	});
	ringS.forEach((s, i) => {
		const a = rad(slotAngles[i]);
		const sin = Math.sin(a);
		const x = cx + R_S * Math.cos(a);
		const y = R_S * sin;
		const lines = wrap(s.row.title, LABEL_MAX);
		singles.push(toSingle(s, x, y, above(sin, lines, y), null));
	});
	blobs.forEach((b, i) => {
		const a = rad(slotAngles[ringS.length + i]);
		const bl = blobOf(b.members.map(() => NODE.radius));
		const x = cx + R_S * Math.cos(a);
		const y = R_S * Math.sin(a);
		const id = `dossier:${b.container.row.ref.key}`;
		const label = shorten(b.container.row.title);
		hulls.push({
			id,
			kind: 'dossier',
			label,
			title: b.container.row.title,
			x,
			y,
			r: bl.r,
			pill: pillOf(label, x, y, bl.r),
			centre: false,
			line: lineOf(b.container.row.relation ? b.container.row : b.members[0].row)
		});
		b.members.forEach((m, k) => {
			const p = bl.pos[k];
			singles.push(toSingle(m, x + p.x, y + p.y, y + p.y + 20, id));
		});
	});

	for (const b of clusters) {
		const under = boxOf(b.lx, b.ly, b.lines);
		const over = boxOf(b.lx, b.y - b.r - 8 - (b.lines.length - 1) * LINE_H, b.lines);
		const free = (box: Box) =>
			!names.some((t) => overlaps(t, box)) && !hulls.some((h) => cutsRim(box, h));
		if (b.lines.length === 0) continue;
		if (free(under)) names.push(under);
		else if (free(over)) {
			b.ly = over.y0 + 11;
			names.push(over);
		} else b.lines = [];
	}
	const centerLines = wrap(centerName, LABEL_MAX);
	// What a name may not cover: the circles with their names, the bron in the middle with its,
	// the pills of the hulls.
	const taken: Box[] = [
		...clusters.flatMap((b) => [
			{ x0: b.x - b.r, y0: b.y - b.r, x1: b.x + b.r, y1: b.y + b.r },
			boxOf(b.lx, b.ly, b.lines)
		]),
		...(centreBlob ? [] : [centreBox]),
		...(centerName && !centreBlob ? [boxOf(cx, 34, centerLines)] : []),
		...hulls.map((h) => ({
			x0: h.pill.x - h.pill.w / 2,
			y0: h.pill.y - 20,
			x1: h.pill.x + h.pill.w / 2,
			y1: h.pill.y
		}))
	];

	for (const l of singles) taken.push({ x0: l.x - 7, y0: l.y - 7, x1: l.x + 7, y1: l.y + 7 });
	// The names in the order of their place to read: the outer ones first, then from the middle
	// out; each one only where it covers nothing named before it and cuts no hull's rim.
	const order = singles
		.map((l, i) => ({ l, i }))
		.sort((p, q) => rank(p.i, singles.length) - rank(q.i, singles.length));
	for (const { l } of order) {
		const box = boxOf(l.lx, l.ly, l.lines!);
		if (taken.some((t) => overlaps(t, box)) || hulls.some((h) => cutsRim(box, h))) l.lines = null;
		else taken.push(box);
	}

	// The omhulling of the law an article stands in: round the bron and its name.
	const homeHull = !centreBlob && context.home ? context.home : null;
	if (homeHull) {
		const half = Math.max(32, widthOf(centerLines) / 2 + 6);
		const foot = 34 + (centerLines.length - 1) * LINE_H + 8;
		const d = hullOutline(
			[
				{ x: cx - half, y: -4 },
				{ x: cx + half, y: -4 },
				{ x: cx - half, y: foot },
				{ x: cx + half, y: foot }
			],
			HOME_MARGIN
		);
		const r = d.polygon[0].x - d.outline[0].x;
		const y = d.outline[0].y + r;
		hulls.push({
			id: 'home',
			kind: 'instrument',
			label: homeHull,
			title: homeHull,
			x: cx,
			y,
			r,
			pill: pillOf(homeHull, cx, y, r),
			centre: false,
			line: null
		});
	}

	// From the top of the highest name to the foot of the lowest.
	const top = Math.min(
		-28,
		...singles.filter((l) => l.lines).map((l) => l.ly - 14),
		...singles.map((l) => l.y - 10),
		...clusters.map((b) => b.y - b.r - 4),
		...clusters.filter((b) => b.ly < b.y).map((b) => b.ly - 14),
		...hulls.map((h) => h.pill.y - 22)
	);
	const foot = Math.max(
		34 + centerLines.length * LINE_H,
		...singles.map((l) => (l.lines ? l.ly + (l.lines.length - 1) * LINE_H + 6 : l.y + 10)),
		...clusters.map((b) => b.y + b.r + 22 + (b.lines.length - 1) * LINE_H),
		...hulls.map((h) => h.y + h.r + 4)
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
	for (const h of hulls) {
		h.y += dy;
		h.pill.y += dy;
	}
	return {
		shape: context.centre
			? vormVanBron(context.centre.collection, context.centre.props, context.centre.key)
			: 'regel',
		singles,
		clusters,
		hulls,
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

/**
 * The one line under the drawing that counts what is drawn: `7 bronnen, 1 groep van 38 uitspraken`.
 * Groups of one kind say what they hold; groups of several say `bronnen`.
 */
export function drawnCount(s: Pick<Sketch, 'singles' | 'clusters' | 'inClusters'>): string {
	const parts: string[] = [];
	const n = s.singles.length;
	if (n > 0) parts.push(`${formatCount(n)} ${plural(n, 'bron', 'bronnen')}`);
	const g = s.clusters.length;
	if (g > 0) {
		const kinds = new Set(s.clusters.map((c) => c.collection));
		const kind = kinds.size === 1 && s.clusters[0].collection;
		const noun = kind ? bronPlural(kind).toLowerCase() : 'bronnen';
		parts.push(
			`${formatCount(g)} ${plural(g, 'groep', 'groepen')} van ${formatCount(s.inClusters)} ${noun}`
		);
	}
	return parts.join(', ');
}
