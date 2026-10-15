// What the Legenda, the sidebar and the keyboard's list of bronnen say of the canvas. What is
// drawn comes from the canvas itself (GraphCanvas `onDrawn`: the filter, the years, the
// strays); the count per kind is before the filter, so the sidebar says what the filter hides.
import type Graph from 'graphology';
import type { ContainerKind } from '$lib/graph/container-membership';
import type { Vorm } from '$lib/bron/vormen';
import type { FilterGroup, Rechter } from '$lib/verbonden/filter';
import type { Relation } from '$lib/vocabulary';

export type CanvasCounts = {
	nodes: number;
	edges: number;
	kinds: Partial<Record<FilterGroup, number>>;
	/** The shapes drawn, for the legend: every shape on the canvas has its line there. */
	vormen: Partial<Record<Vorm, number>>;
	/** Per kind, the bronnen hidden with a grouping switched off, and which groupings. */
	metGroep: Partial<Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>>;
};

/** Whether two lists of drawn bronnen hold the same ones: the list is not handed on unchanged. */
export const sameIds = (a: readonly string[], b: readonly string[]) => {
	if (a.length !== b.length) return false;
	const kept = new Set(a);
	return b.every((id) => kept.has(id));
};

export const NO_COUNTS: CanvasCounts = { nodes: 0, edges: 0, kinds: {}, vormen: {}, metGroep: {} };

export function countCanvas(o: {
	graph: Graph;
	/** The bronnen the canvas draws. */
	drawn: ReadonlySet<string>;
	selectionId: string | null;
	hiddenKinds: ReadonlySet<FilterGroup>;
	rechter: Rechter | null;
	/** The bronnen hidden with their grouping (`metGroepVerborgen`). */
	verborgen: ReadonlyMap<string, ContainerKind>;
	hiddenRelations: ReadonlySet<Relation>;
}): { counts: CanvasCounts; drawnIds: string[] } {
	const { graph, drawn, selectionId, hiddenKinds, rechter, verborgen } = o;
	let nodes = 0;
	let edges = 0;
	const kinds: CanvasCounts['kinds'] = {};
	const vormen: CanvasCounts['vormen'] = {};
	const metGroep: CanvasCounts['metGroep'] = {};
	const bronnen: Partial<Record<FilterGroup, number>> = {};
	const drawnIds: string[] = [];
	graph.forEachNode((id, attrs) => {
		const kind = attrs.filterGroup as FilterGroup | undefined;
		if (kind) kinds[kind] = (kinds[kind] ?? 0) + 1;
		if (drawn.has(id)) {
			drawnIds.push(id);
			nodes++;
			const vorm = attrs.vorm as Vorm | undefined;
			if (vorm && !attrs.anchor) vormen[vorm] = (vormen[vorm] ?? 0) + 1;
		}
		if (!kind || attrs.anchor) return;
		const otherCourt = rechter && attrs.collection === 'judgments' && attrs.rechter !== rechter;
		if (id !== selectionId && (hiddenKinds.has(kind) || otherCourt)) return;
		bronnen[kind] = (bronnen[kind] ?? 0) + 1;
		const groep = verborgen.get(id);
		if (!groep) return;
		const m = (metGroep[kind] ??= { count: 0, van: 0, groepen: [] });
		m.count++;
		if (!m.groepen.includes(groep)) m.groepen.push(groep);
	});
	graph.forEachEdge((_id, attrs, src, tgt) => {
		if (attrs.layoutOnly || !drawn.has(src) || !drawn.has(tgt)) return;
		if (o.hiddenRelations.has(attrs.relation as Relation)) return;
		edges++;
	});
	for (const [k, m] of Object.entries(metGroep)) m.van = bronnen[k as FilterGroup] ?? 0;
	return { counts: { nodes, edges, kinds, vormen, metGroep }, drawnIds };
}
