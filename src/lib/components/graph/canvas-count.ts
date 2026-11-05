// What the Legenda, the sidebar and the keyboard's list of bronnen say of the canvas. What is
// drawn comes from the canvas itself (GraphCanvas `onDrawn`: the filter, the years, the
// strays); the count per kind is before the filter, so the sidebar says what the filter hides.
import type Graph from 'graphology';
import type { ContainerKind } from '$lib/graph/container-membership';
import type { Vorm } from '$lib/bron/vormen';
import type { FilterGroup, HiddenKind, Rechter } from '$lib/verbonden/filter';
import type { Stuksoort } from '$lib/bron/rubrieken';
import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
import type { DrawClass } from '$lib/graph/types';
import type { Relation } from '$lib/vocabulary';

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

export function countCanvas(o: {
	graph: Graph;
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
}): { counts: CanvasCounts; drawnIds: string[] } {
	const { graph, drawn, selectionId, hiddenKinds, rechter, verborgen } = o;
	let nodes = 0;
	let edges = 0;
	let annexes = 0;
	const kinds: CanvasCounts['kinds'] = {};
	const drawnKinds: CanvasCounts['kinds'] = {};
	const stuksoorten: NonNullable<CanvasCounts['stuksoorten']> = {};
	const vormen: CanvasCounts['vormen'] = {};
	const metGroep: CanvasCounts['metGroep'] = {};
	const bronnen: Partial<Record<FilterGroup, number>> = {};
	const drawnIds: string[] = [];
	graph.forEachNode((id, attrs) => {
		const kind = attrs.filterGroup as FilterGroup | undefined;
		const other = attrs.drawClass === 'other' && !attrs.anchor;
		if (other) annexes++;
		const dated = typeof attrs.date === 'string' ? attrs.date : null;
		const outsidePeriod = (day: string | null) => outsideOf(o.period, day);
		const outside = id !== selectionId && outsidePeriod(dated);
		// A group counts the members inside the period, as the strip does (not its whole size).
		const memberDates = Array.isArray(attrs.memberDates)
			? (attrs.memberDates as (string | null)[])
			: null;
		const inside = memberDates
			? memberDates.filter((day) => !outsidePeriod(day)).length
			: ((attrs.members as number | undefined) ?? 1);
		if (kind && !other && !outside) {
			add(kinds, kind, inside);
			if (drawn.has(id)) add(drawnKinds, kind, inside);
		}
		if (attrs.stuksoort && !other)
			add(stuksoorten, attrs.stuksoort as Stuksoort, (attrs.members as number | undefined) ?? 1);
		if (drawn.has(id)) {
			drawnIds.push(id);
			nodes++;
			const vorm = attrs.vorm as Vorm | undefined;
			if (vorm && !attrs.anchor) add(vormen, vorm);
		}
		if (!kind || attrs.anchor) return;
		const otherCourt = rechter && attrs.collection === 'judgments' && attrs.rechter !== rechter;
		const hiddenFacet =
			!!attrs.stuksoort && hiddenKinds.has(`stuksoort:${attrs.stuksoort}` as HiddenKind);
		if (id !== selectionId && (hiddenKinds.has(kind) || hiddenFacet || otherCourt)) return;
		add(bronnen, kind);
		const groep = verborgen.get(id);
		if (!groep) return;
		const m = (metGroep[kind] ??= { count: 0, van: 0, groepen: [] });
		m.count++;
		if (!m.groepen.includes(groep)) m.groepen.push(groep);
	});
	for (const r of o.rings ?? []) add(kinds, r.filterGroup);
	for (const r of o.ringsShown ?? o.rings ?? []) add(drawnKinds, r.filterGroup);
	const lines: CanvasCounts['lines'] = {};
	graph.forEachEdge((_id, attrs, src, tgt) => {
		if (attrs.layoutOnly || !drawn.has(src) || !drawn.has(tgt)) return;
		const relation = attrs.relation as Relation;
		const kind = lineKindOf(relation, graph.getNodeAttribute(src, 'drawClass') as DrawClass);
		add(lines, kind);
		if (o.hiddenLines.has(kind)) return;
		edges++;
	});
	for (const [k, m] of Object.entries(metGroep)) m.van = bronnen[k as FilterGroup] ?? 0;
	return {
		counts: { nodes, edges, kinds, drawnKinds, stuksoorten, vormen, metGroep, annexes, lines },
		drawnIds
	};
}
