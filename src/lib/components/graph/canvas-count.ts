// What the Legenda, the sidebar and the keyboard's list of bronnen say of the canvas. What is
// drawn comes from the lanes themselves (LanesView `onDrawn`: the filter, the years, the
// strays); the count per kind is before the filter, so the sidebar says what the filter hides.
import { kindColour } from '$lib/bron/kleur';
import { sortColour } from '$lib/bron/rubrieken';
import { makerSorts } from '$lib/graph/roles';
import { filterGroupOf } from '$lib/verbonden/filter';
import type { ContainerKind } from '$lib/graph/container-membership';
import type { Vorm } from '$lib/bron/vormen';
import type { FilterGroup, HiddenKind, Rechter } from '$lib/verbonden/filter';
import type { Stuksoort } from '$lib/bron/rubrieken';
import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
import type { DrawClass, GraphEdge, GraphNode } from '$lib/graph/types';
import type { Relation } from '$lib/vocabulary';

/** What the counts read of a bron on the lanes: its kind, its shape, its day, its court. */
export type CountNode = {
	drawClass: DrawClass;
	vorm?: Vorm;
	collection: string;
	filterGroup?: FilterGroup;
	stuksoort: Stuksoort | null;
	rechter: Rechter | null;
	date: string | null;
	/** A wet's anchor: a point its hull stands on, no bron of its own. */
	anchor: boolean;
};

/** A line between two bronnen, as the counts read it. */
export type CountEdge = { source: string; target: string; relation: Relation };

export type CanvasCounts = {
	nodes: number;
	edges: number;
	kinds: Partial<Record<FilterGroup, number>>;
	/** Per kind, what the canvas draws of it now: fewer than `kinds` where a filter hides them. */
	drawnKinds?: Partial<Record<FilterGroup, number>>;
	/** The stukken among them, per stuksoort: the block Stuksoort of Tonen. */
	stuksoorten?: Partial<Record<Stuksoort, number>>;
	/** The shapes drawn, for the legend: every shape on the canvas has its line there. */
	vormen: Partial<Record<Vorm, number>>;
	/** Per kind, the bronnen hidden with a grouping switched off, and which groupings. */
	metGroep: Partial<Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>>;
	/** The annexes drawn (a bron of no kind of its own), before the filter: a row of Tonen. */
	annexes: number;
	/** The lines between two bronnen drawn, per lijnsoort, shown or switched off: Relatie. */
	lines: Partial<Record<LineKind, number>>;
};

/** Whether two lists of drawn bronnen hold the same ones: the list is not handed on unchanged. */
export const sameIds = (a: readonly string[], b: readonly string[]) => {
	if (a.length !== b.length) return false;
	const kept = new Set(a);
	return b.every((id) => kept.has(id));
};

export const NO_COUNTS: CanvasCounts = {
	nodes: 0,
	edges: 0,
	kinds: {},
	vormen: {},
	metGroep: {},
	annexes: 0,
	lines: {}
};

/**
 * The kind and colour of each bron on the canvas, as Tonen counts and hides it: a person by their
 * role on the day of their first stuk on the canvas (`makerSorts`, B122), as the lanes place them.
 */
export function canvasKinds(nodes: readonly GraphNode[], edges: readonly GraphEdge[]) {
	const makers = makerSorts(nodes, edges);
	return {
		kindOf: (n: GraphNode): FilterGroup =>
			makers.get(n.id) ?? filterGroupOf(n.collection, n.key, n.raw?.props ?? null),
		colourOf: (n: GraphNode): string => {
			const sort = makers.get(n.id);
			return sort ? sortColour(sort) : kindColour(n.collection, null, n.raw?.props);
		}
	};
}

/** One more of `k`, or `n` more. */
function add<K extends string>(to: Partial<Record<K, number>>, k: K, n = 1) {
	to[k] = (to[k] ?? 0) + n;
}

type Period = { from: string | null; to: string | null };

/** Whether a dated bron lies outside the years of the bronfilter. */
const outsideOf = (period: Period | null | undefined, day: string | null) =>
	!!period &&
	day !== null &&
	((period.from !== null && day < period.from) || (period.to !== null && day > period.to));

type CountInput = {
	/** The bronnen of the lanes by id, and the lines between them. */
	nodes: ReadonlyMap<string, CountNode>;
	edges: readonly CountEdge[];
	/** The bronnen the canvas draws. */
	drawn: ReadonlySet<string>;
	selectionId: string | null;
	hiddenKinds: ReadonlySet<HiddenKind>;
	rechter: Rechter | null;
	/** The years of the bronfilter: a dated bron outside them is not counted per kind. */
	period?: Period | null;
	/** The bronnen hidden with their grouping (`metGroepVerborgen`). */
	verborgen: ReadonlyMap<string, ContainerKind>;
	hiddenLines: ReadonlySet<LineKind>;
	/** The commissies and dossiers drawn as a ring with no point of their own: one bron each. */
	rings?: readonly { filterGroup: FilterGroup }[];
	/** Of those, the ones drawn now; without it, all of `rings`. */
	ringsShown?: readonly { filterGroup: FilterGroup }[];
};

type Tally = Pick<CanvasCounts, 'kinds' | 'vormen' | 'metGroep'> & {
	nodes: number;
	annexes: number;
	drawnKinds: NonNullable<CanvasCounts['drawnKinds']>;
	stuksoorten: NonNullable<CanvasCounts['stuksoorten']>;
	/** Per kind, the bronnen the filter leaves. */
	bronnen: Partial<Record<FilterGroup, number>>;
	drawnIds: string[];
};

/** One bron into the counts: before the filter per kind, then what the filter leaves. */
function tally(t: Tally, o: CountInput, id: string, attrs: CountNode) {
	const kind = attrs.filterGroup;
	const other = attrs.drawClass === 'other' && !attrs.anchor;
	if (other) t.annexes++;
	const outside = id !== o.selectionId && outsideOf(o.period, attrs.date);
	if (kind && !other && !outside) {
		add(t.kinds, kind);
		if (o.drawn.has(id)) add(t.drawnKinds, kind);
	}
	if (attrs.stuksoort && !other) add(t.stuksoorten, attrs.stuksoort);
	if (o.drawn.has(id)) {
		t.drawnIds.push(id);
		t.nodes++;
		if (attrs.vorm && !attrs.anchor) add(t.vormen, attrs.vorm);
	}
	if (!kind || attrs.anchor) return;
	const otherCourt = o.rechter && attrs.collection === 'judgments' && attrs.rechter !== o.rechter;
	const hiddenFacet =
		!!attrs.stuksoort && o.hiddenKinds.has(`stuksoort:${attrs.stuksoort}` as HiddenKind);
	if (id !== o.selectionId && (o.hiddenKinds.has(kind) || hiddenFacet || otherCourt)) return;
	add(t.bronnen, kind);
	const groep = o.verborgen.get(id);
	if (!groep) return;
	const m = (t.metGroep[kind] ??= { count: 0, van: 0, groepen: [] });
	m.count++;
	if (!m.groepen.includes(groep)) m.groepen.push(groep);
}

export function countCanvas(o: CountInput): { counts: CanvasCounts; drawnIds: string[] } {
	const t: Tally = {
		nodes: 0,
		annexes: 0,
		kinds: {},
		drawnKinds: {},
		stuksoorten: {},
		vormen: {},
		metGroep: {},
		bronnen: {},
		drawnIds: []
	};
	for (const [id, attrs] of o.nodes) tally(t, o, id, attrs);
	for (const r of o.rings ?? []) add(t.kinds, r.filterGroup);
	for (const r of o.ringsShown ?? o.rings ?? []) add(t.drawnKinds, r.filterGroup);
	let edges = 0;
	const lines: CanvasCounts['lines'] = {};
	for (const { source, target, relation } of o.edges) {
		if (!o.drawn.has(source) || !o.drawn.has(target)) continue;
		const kind = lineKindOf(relation, o.nodes.get(source)?.drawClass ?? 'other');
		add(lines, kind);
		if (!o.hiddenLines.has(kind)) edges++;
	}
	for (const [k, m] of Object.entries(t.metGroep)) m.van = t.bronnen[k as FilterGroup] ?? 0;
	const { nodes, annexes, kinds, drawnKinds, stuksoorten, vormen, metGroep } = t;
	return {
		counts: { nodes, edges, kinds, drawnKinds, stuksoorten, vormen, metGroep, annexes, lines },
		drawnIds: t.drawnIds
	};
}
