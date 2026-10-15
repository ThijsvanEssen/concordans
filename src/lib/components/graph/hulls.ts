// The hulls of the canvas, in screen pixels: a soft outline behind a wet's articles or a
// fractie's, commissie's or dossier's members, its name in a pill above it, and the lines
// that join one hull to another or to a bron. GraphCanvas draws them as SVG and HTML over
// sigma; this module only says where, from a graph and a projection to the screen.
import type Graph from 'graphology';
import type { Collection, Relation } from '$lib/vocabulary';
import { relationLabel } from '$lib/verbonden/hoe';
import type { ContainerGroup } from '$lib/graph/container-membership';
import { centroid, exitPoint, hullOutline, type Point } from '$lib/graph/hull';
import type { GraphNodeKind } from '$lib/graph/types';
import { overlaps, type Rect } from './label-place';
import { edgeColorFor, hullColorFor, hullDashFor } from './nodeSprites';

/** Between a hull and its members. */
export const HULL_MARGIN = 16;
/** Between a hull's top and its name. */
export const LABEL_GAP = 8;
/** The height of a hull's name, one line. */
export const LABEL_HEIGHT = 22;
/** Between a hull's name and the edge of the canvas or a panel over it. */
export const EDGE_GAP = 10;
/** The length of an arrowhead on a line of a hull, and half its width. */
const ARROW_LENGTH = 7;
const ARROW_HALF = 3.5;
/** The places a hull's name tries: its own, and three steps down into its hull. */
const LABEL_STEPS = 4;

export type Hull = {
	id: string;
	path: string;
	color: string;
	/** The line of its kind (`hullDashFor`): the kind reads without its colour. */
	dash: string | undefined;
	labelX: number;
	labelY: number;
	label: string;
	/** Wider than the canvas: the name wraps instead of being cut. */
	long: boolean;
	/** Out of the hover: the hovered bron is not in it and not tied to it. */
	dim: boolean;
};

export type HullLink = {
	id: string;
	d: string;
	arrow: string;
	color: string;
	dashed: boolean;
	dim: boolean;
	/** The relation in words, shown while one of its hulls is in the hover. */
	label: string | null;
	labelX: number;
	labelY: number;
};

/** Where the pointer finds a hull: its shape, or its name. */
export type HullHitArea = { id: string; polygon: Point[]; label: Rect };

/** The groups of the canvas, as the hulls and the lines read them. */
export type HullGroups = {
	graph: Graph;
	groups: ReadonlyMap<string, ContainerGroup>;
	/** The groups each bron is in, without the groupings switched off. */
	groupsOf: ReadonlyMap<string, ReadonlySet<string>>;
	/** Whether a group is drawn as a hull (`isDrawnGroup`). */
	drawn: (group: ContainerGroup) => boolean;
	/** The kinds of group switched off. */
	hiddenKinds: ReadonlySet<string>;
};

const isAnchor = (graph: Graph, id: string) =>
	graph.hasNode(id) && !!graph.getNodeAttribute(id, 'anchor');

/**
 * A line from a bron in a hull to a container's anchor (the change a dossier proposes to a
 * wet) is drawn once, hull to hull, instead of once per stuk: the pair of hulls, or null.
 */
export function hullLinkOf(
	src: string,
	tgt: string,
	{ graph, groups, groupsOf, drawn }: HullGroups
): { from: string; to: string } | null {
	if (!isAnchor(graph, tgt)) return null;
	const to = [...(groupsOf.get(tgt) ?? [])][0];
	const from = [...(groupsOf.get(src) ?? [])].find((id) => {
		const group = groups.get(id);
		return group && group.kind !== 'instrument' && drawn(group);
	});
	return to && from ? { from, to } : null;
}

/**
 * A container's anchor (a wet, a fractie) is no bron on the canvas, only its hull: a line to
 * it is drawn to the edge of that hull, not into it (Thijs, 9 Oct). True when the anchor's
 * hull is drawn; then the line is the hulls' layer's, not sigma's.
 */
export function anchorWithHull(id: string, h: HullGroups): boolean {
	if (!isAnchor(h.graph, id)) return false;
	return [...(h.groupsOf.get(id) ?? [])].some((g) => {
		const group = h.groups.get(g);
		return !!group && h.drawn(group) && !h.hiddenKinds.has(group.kind);
	});
}

/** What the hulls are laid out from: the groups, the screen, the hover and the names. */
export type HullScene = HullGroups & {
	/** A bron not shown: outside the filter, or left with nothing to show it by. */
	isHidden: (id: string, attrs: Record<string, unknown>) => boolean;
	/** Where a point of the graph stands on the screen. */
	toViewport: (p: Point) => Point;
	/** A bron's drawn radius on the screen. */
	radiusOf: (id: string) => number;
	/** A group's name, short and in full (a wet's citation title from its meta). */
	namesOf: (group: ContainerGroup) => { short: string; full: string };
	/** The width of a hull's name in its pill. */
	labelWidth: (text: string) => number;
	/** The width of the canvas. */
	width: number;
	/** Zoomed out: a hull of only bronnen between the chosen ones waits for a hover. */
	zoomedOut: boolean;
	/** A panel floating over the canvas: the names keep clear of it. */
	avoid: { x: number; y: number; width: number; height: number } | null;
	hoveredHullId: string | null;
	hoveredId: string | null;
	/** The bronnen tied to the hovered one. */
	hoveredNeighbours: ReadonlySet<string>;
	focusedId: string | null;
	pinnedIds: ReadonlySet<string>;
	/** Where the focus's name stands: a hull's name stands elsewhere. */
	focusName: Rect | undefined;
};

type HullLayout = { hulls: Hull[]; links: HullLink[]; hitAreas: HullHitArea[] };

type Drawn = Hull & { polygon: Point[]; center: Point; members: ReadonlySet<string> };

/**
 * A label pill (centred on x, its bottom at y) moved clear of the floating panel: to the
 * panel's left where it fits, else below it.
 */
function clearOfPanel(x: number, y: number, half: number, avoid: HullScene['avoid']): Point {
	const r = avoid;
	if (!r) return { x, y };
	const hits =
		x + half > r.x && x - half < r.x + r.width && y > r.y && y - LABEL_HEIGHT < r.y + r.height;
	if (!hits) return { x, y };
	const left = r.x - half - EDGE_GAP;
	if (left >= half + EDGE_GAP) return { x: left, y };
	return { x, y: r.y + r.height + LABEL_HEIGHT + EDGE_GAP };
}

/** The path of a line from `start` to the foot of its arrowhead at `end`, and the arrowhead. */
function arrowLine(start: Point, end: Point): { d: string; arrow: string } {
	const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
	const ux = (end.x - start.x) / len;
	const uy = (end.y - start.y) / len;
	const back = { x: end.x - ux * ARROW_LENGTH, y: end.y - uy * ARROW_LENGTH };
	return {
		d: `M ${start.x} ${start.y} L ${back.x} ${back.y}`,
		arrow: `M ${end.x} ${end.y} L ${back.x - uy * ARROW_HALF} ${back.y + ux * ARROW_HALF} L ${back.x + uy * ARROW_HALF} ${back.y - ux * ARROW_HALF} Z`
	};
}

/** What a line says: its words, and `voorgesteld` for a change still proposed. */
const said = (words: string, status: unknown) =>
	[words, status === 'voorgesteld' ? 'voorgesteld' : null].filter(Boolean).join(', ');

/** The hull of each drawn group, with its name placed where no other name stands. */
function drawHulls(s: HullScene): { drawn: Map<string, Drawn>; anchorHull: Map<string, Drawn> } {
	const { graph } = s;
	const drawn = new Map<string, Drawn>();
	// The labels placed so far, and the focus's name: a hull's label takes a free place
	// (UX test 10 Oct, #25: "Verdrag tot bescherming…" over "Richtlijn (EU) 2019/1023", the
	// focus's name covered). The labels lie over the canvas, so they decide.
	const taken: Rect[] = s.focusName ? [s.focusName] : [];
	/** Per anchor, the hull drawn for it. */
	const anchorHull = new Map<string, Drawn>();
	for (const group of s.groups.values()) {
		if (!s.drawn(group) || s.hiddenKinds.has(group.kind)) continue;
		const points: Point[] = [];
		let anchorPoint: Point | null = null;
		for (const id of group.members) {
			if (!graph.hasNode(id)) continue;
			const attrs = graph.getNodeAttributes(id);
			if (s.isHidden(id, attrs)) continue;
			const p = s.toViewport({ x: attrs.x as number, y: attrs.y as number });
			if (attrs.anchor) anchorPoint = p;
			else points.push(p);
		}
		// The anchor is no bron: the hull goes round what it holds, not to where the anchor is
		// pulled (Awb with only art. 3:4 was a pill to an empty point, Thijs 9 Oct). An anchor
		// alone is its own empty hull.
		if (points.length === 0 && anchorPoint) points.push(anchorPoint);
		// One member is a hull when it is a container's anchor (the wet or fractie itself,
		// drawn as an empty hull), the dossier of a stuk on a path between chosen bronnen
		// (`lone`), or an article: an article always stands in its wet (Thijs, 9 Oct).
		const anchor = [...group.members].find((id) => isAnchor(graph, id));
		if (points.length < (anchor || group.lone || group.kind === 'instrument' ? 1 : 2)) continue;
		const names = s.namesOf(group);
		const label =
			names.short ||
			(anchor ? ((graph.getNodeAttribute(anchor, 'anchorNaam') as string) ?? '') : '');
		if (!label) continue;
		// The full name while the hull, or a bron in it, is under the pointer.
		const inHover =
			s.hoveredHullId === group.id || (s.hoveredId !== null && group.members.has(s.hoveredId));
		// In a netwerk, a hull of only bronnen between the chosen ones names itself on a hover or
		// zoomed in; zoomed out its name would cover the chosen bronnen (6e).
		const quiet =
			s.pinnedIds.size > 0 &&
			!inHover &&
			s.zoomedOut &&
			![...group.members].some((id) => id === s.focusedId || s.pinnedIds.has(id));
		const shown = quiet ? '' : inHover && names.full ? names.full : label;
		// The label anchors to this hull's own outline, not a raw member point: a bron in
		// several groups at once (a lid on many commissies) would otherwise put every one of
		// its hulls' labels on that one shared point.
		const { outline, polygon, path } = hullOutline(points, HULL_MARGIN);
		const top = outline.reduce((a, b) => (b.y < a.y ? b : a));
		// Above the hull's top, but never past the edge of the canvas: a hull at the border (or
		// a fit that leaves little room) would cut its label in half.
		const room = s.width - 2 * EDGE_GAP;
		const half = Math.min(s.labelWidth(shown), room) / 2;
		// A name wider than the canvas wraps; its lines stay below the top edge.
		const lines = Math.ceil(s.labelWidth(shown) / room);
		const at = clearOfPanel(
			Math.min(
				Math.max(top.x, half + EDGE_GAP),
				Math.max(half + EDGE_GAP, s.width - half - EDGE_GAP)
			),
			Math.max(top.y - LABEL_GAP, lines * LABEL_HEIGHT + EDGE_GAP),
			half,
			s.avoid
		);
		// Its own place, or a step down into its hull; with none free it waits for a hover, as
		// a bron's name does. Under the pointer it stands regardless.
		const high = lines * LABEL_HEIGHT;
		let place: Point | null = null;
		for (let step = 0; step < LABEL_STEPS && shown; step++) {
			const y = at.y + step * (LABEL_HEIGHT + 4);
			const r = { x: at.x - half, y: y - high, w: half * 2, h: high };
			if (!taken.some((b) => overlaps(r, b))) {
				place = { x: at.x, y };
				taken.push(r);
				break;
			}
		}
		if (!place && inHover) place = at;
		const hull: Drawn = {
			id: group.id,
			path,
			color: hullColorFor(group.kind),
			dash: hullDashFor(group.kind),
			label: place ? shown : '',
			long: lines > 1,
			labelX: (place ?? at).x,
			labelY: (place ?? at).y,
			dim: false,
			polygon,
			center: centroid(points),
			members: group.members
		};
		drawn.set(group.id, hull);
		if (anchor) anchorHull.set(anchor, hull);
	}
	return { drawn, anchorHull };
}

const wordOf = (graph: Graph, attrs: Record<string, unknown>, src: string, tgt: string) =>
	relationLabel(
		attrs.relation as Relation,
		graph.getNodeAttribute(src, 'collection') as Collection,
		graph.getNodeAttribute(tgt, 'collection') as Collection,
		attrs.meta as Record<string, unknown> | null
	);

export function layoutHulls(s: HullScene): HullLayout {
	const { graph } = s;
	if (s.groups.size === 0) return { hulls: [], links: [], hitAreas: [] };
	const { drawn, anchorHull } = drawHulls(s);

	// One line per pair of hulls, from where it leaves the one to where it enters the other.
	// It says every verbinding it stands for, each in the words of its own source (hoe.ts),
	// the most frequent first: `wijzigt, licht toe, noemt` between a dossier and a wet.
	const pairs = new Map<
		string,
		{ from: Drawn; to: Drawn; relation: Relation; status: unknown; words: Map<string, number> }
	>();
	graph.forEachEdge((_e, attrs, src, tgt) => {
		const pair = !attrs.layoutOnly && hullLinkOf(src, tgt, s);
		const from = pair && drawn.get(pair.from);
		const to = pair && drawn.get(pair.to);
		if (!from || !to) return;
		const id = `${from.id}->${to.id}`;
		let link = pairs.get(id);
		if (!link) {
			link = {
				from,
				to,
				relation: attrs.relation as Relation,
				status: attrs.status,
				words: new Map()
			};
			pairs.set(id, link);
		}
		const word = wordOf(graph, attrs, src, tgt);
		link.words.set(word, (link.words.get(word) ?? 0) + 1);
	});

	// In the hover: the hulls that hold the hovered bron or one tied to it, or the hovered
	// hull, and every hull a line joins to those. The rest steps back.
	let active: Set<string> | null = null;
	if (s.hoveredHullId && drawn.has(s.hoveredHullId)) active = new Set([s.hoveredHullId]);
	else if (s.hoveredId !== null) {
		const hovered = s.hoveredId;
		active = new Set();
		for (const h of drawn.values())
			if (h.members.has(hovered) || [...h.members].some((m) => s.hoveredNeighbours.has(m)))
				active.add(h.id);
	}
	if (active) {
		for (const { from, to } of pairs.values()) {
			if (active.has(from.id) || active.has(to.id)) {
				active.add(from.id);
				active.add(to.id);
			}
		}
		for (const h of drawn.values()) h.dim = !active.has(h.id);
	}

	const links: HullLink[] = [];
	for (const [id, { from, to, relation, status, words }] of pairs) {
		const start = exitPoint(from.center, to.center, from.polygon);
		const end = exitPoint(to.center, from.center, to.polygon);
		const lit = active !== null && active.has(from.id) && active.has(to.id);
		const byCount = [...words]
			.sort((a, b) => b[1] - a[1])
			.map(([w]) => w)
			.join(', ');
		links.push({
			id,
			...arrowLine(start, end),
			color: edgeColorFor(relation, 'document'),
			dashed: status === 'voorgesteld',
			dim: active !== null && !lit,
			label: lit ? said(byCount, status) : null,
			labelX: (start.x + end.x) / 2,
			labelY: (start.y + end.y) / 2
		});
	}
	links.push(...anchorLines(s, anchorHull, active));

	const hulls = [...drawn.values()];
	hideCrowdedNames(s, hulls);
	return {
		hulls: hulls.map(({ polygon: _p, center: _c, members: _m, ...hull }) => hull),
		links,
		hitAreas: hulls.map((h) => {
			const w = s.labelWidth(h.label);
			return {
				id: h.id,
				polygon: h.polygon,
				label: { x: h.labelX - w / 2, y: h.labelY - LABEL_HEIGHT, w, h: LABEL_HEIGHT }
			};
		})
	};
}

/**
 * A line to an anchor ends at the edge of its hull, its arrow there; a line from one starts at
 * that edge. One per bron and hull.
 */
function anchorLines(
	s: HullScene,
	anchorHull: ReadonlyMap<string, Drawn>,
	active: ReadonlySet<string> | null
): HullLink[] {
	const { graph } = s;
	const links: HullLink[] = [];
	const seen = new Set<string>();
	const pointOf = (id: string) => {
		const a = graph.getNodeAttributes(id);
		return s.toViewport({ x: a.x as number, y: a.y as number });
	};
	/** The point `radius` px from the centre of bron `id` toward `toward`. */
	const rim = (id: string, toward: Point): Point => {
		const p = pointOf(id);
		const d = Math.hypot(toward.x - p.x, toward.y - p.y) || 1;
		const radius = s.radiusOf(id) + 2;
		return { x: p.x + ((toward.x - p.x) / d) * radius, y: p.y + ((toward.y - p.y) / d) * radius };
	};
	graph.forEachEdge((_e, attrs, src, tgt) => {
		if (attrs.layoutOnly || hullLinkOf(src, tgt, s)) return;
		const fromHull = anchorHull.get(src);
		const toHull = anchorHull.get(tgt);
		if (!fromHull && !toHull) return;
		const nodeEnd = !fromHull ? src : !toHull ? tgt : null;
		if (nodeEnd && s.isHidden(nodeEnd, graph.getNodeAttributes(nodeEnd))) return;
		const key = `${fromHull?.id ?? src}->${toHull?.id ?? tgt}`;
		if (seen.has(key)) return;
		seen.add(key);
		let start: Point;
		let end: Point;
		if (fromHull && toHull) {
			start = exitPoint(fromHull.center, toHull.center, fromHull.polygon);
			end = exitPoint(toHull.center, fromHull.center, toHull.polygon);
		} else if (toHull) {
			end = exitPoint(toHull.center, pointOf(src), toHull.polygon);
			start = rim(src, end);
		} else {
			start = exitPoint(fromHull!.center, pointOf(tgt), fromHull!.polygon);
			end = rim(tgt, start);
		}
		const hull = (toHull ?? fromHull)!;
		const lit = s.hoveredHullId === hull.id || (nodeEnd !== null && s.hoveredId === nodeEnd);
		links.push({
			id: `anker:${key}`,
			...arrowLine(start, end),
			color: edgeColorFor(
				attrs.relation as Relation,
				graph.getNodeAttribute(src, 'kind') as GraphNodeKind
			),
			dashed: attrs.status === 'voorgesteld',
			dim: active !== null && !lit && !active.has(hull.id),
			label: lit ? said(wordOf(graph, attrs, src, tgt), attrs.status) : null,
			labelX: (start.x + end.x) / 2,
			labelY: (start.y + end.y) / 2
		});
	});
	return links;
}

/**
 * A hull's name stands where no other hull's name stands (6e: around art. 273f a dozen law
 * hulls named themselves on top of each other in a column). The hull under the pointer goes
 * first, then the one holding the focus or a chosen bron, then the larger; a name with no
 * free place waits for a hover or a zoom.
 */
function hideCrowdedNames(s: HullScene, hulls: Drawn[]) {
	const precedence = (h: Drawn) =>
		(s.hoveredHullId === h.id || (s.hoveredId !== null && h.members.has(s.hoveredId)) ? 4 : 0) +
		(s.focusedId !== null && h.members.has(s.focusedId) ? 2 : 0) +
		([...h.members].some((id) => s.pinnedIds.has(id)) ? 1 : 0);
	const placed: Rect[] = [];
	for (const h of [...hulls].sort(
		(a, b) => precedence(b) - precedence(a) || b.members.size - a.members.size
	)) {
		if (!h.label) continue;
		const w = s.labelWidth(h.label);
		const r = { x: h.labelX - w / 2, y: h.labelY - LABEL_HEIGHT, w, h: LABEL_HEIGHT };
		if (placed.some((o) => overlaps(r, o)) && precedence(h) < 4) {
			h.label = '';
			continue;
		}
		placed.push(r);
	}
}
