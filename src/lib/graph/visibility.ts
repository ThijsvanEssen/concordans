// What Tonen and Relatie leave of a canvas, in one place (B51). The scene is built from what this
// returns, so no layer (a hull, a group, a line, a count) shows a bron or a line the filter hides.
// Tonen hides soorten and stuksoorten; Relatie hides lijnsoorten. A hidden wet or dossier takes
// its hull along: the articles of a hidden wet and the stukken of a hidden dossier go with it.
import { sortOf, stuksoortOf } from '$lib/bron/rubrieken';
import type { HiddenKind } from '$lib/verbonden/filter';
import { lineKindOf, type LineKind } from './line-kind';
import { isHullEdge } from './scene-hulls';
import { lawIdOf, type GraphEdge, type GraphNode } from './types';

export type Visibility = {
	/** Tonen: the soorten and stuksoorten switched off (`hiddenKindsOf`). */
	hiddenKinds: ReadonlySet<HiddenKind>;
	/** Relatie: the lijnsoorten switched off. */
	hiddenLines: ReadonlySet<LineKind>;
};

export const SHOW_ALL: Visibility = { hiddenKinds: new Set(), hiddenLines: new Set() };

/**
 * Whether Tonen hides a bron by its own soort: a stuk also by its stuksoort, an article also by the
 * soort of its wet (when that wet is not on the canvas itself).
 */
function isHiddenKind(node: GraphNode, hidden: ReadonlySet<HiddenKind>): boolean {
	const props = node.raw?.props;
	if (hidden.has(sortOf(node.collection, node.key, props))) return true;
	if (node.collection === 'documents') return hidden.has(`stuksoort:${stuksoortOf(props)}`);
	const law = lawIdOf(props);
	return node.drawClass === 'article' && !!law && hidden.has(sortOf('instruments', law, props));
}

/** The ids of the hidden bronnen: by their soort, or as a member of a hidden wet or dossier. */
function hiddenIds(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	hidden: ReadonlySet<HiddenKind>
): Set<string> {
	const out = new Set(nodes.filter((n) => isHiddenKind(n, hidden)).map((n) => n.id));
	const byId = new Map(nodes.map((n) => [n.id, n]));
	for (const e of edges)
		if (out.has(e.target) && isHullEdge(byId.get(e.source), byId.get(e.target), e.relation))
			out.add(e.source);
	return out;
}

/**
 * The bronnen and edges Tonen and Relatie leave: an edge only between two bronnen that stay, and
 * of a lijnsoort that is on unless it puts a bron in its hull (that draws no line).
 */
export function visibleGraph(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	visibility: Visibility
): { nodes: GraphNode[]; edges: GraphEdge[] } {
	const hidden = hiddenIds(nodes, edges, visibility.hiddenKinds);
	const kept = nodes.filter((n) => !hidden.has(n.id));
	const byId = new Map(kept.map((n) => [n.id, n]));
	const shown = (e: GraphEdge) => {
		const from = byId.get(e.source);
		const to = byId.get(e.target);
		if (!from || !to) return false;
		return (
			isHullEdge(from, to, e.relation) ||
			!visibility.hiddenLines.has(lineKindOf(e.relation, from.drawClass))
		);
	};
	return { nodes: kept, edges: edges.filter(shown) };
}
