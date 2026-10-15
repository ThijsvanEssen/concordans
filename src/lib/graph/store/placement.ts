// Where a verbinding lands on the canvas: one decision for every loader that puts one there
// (a node response, a neighbourhood, the paths between chosen bronnen, rows of Verbonden).
// A bron goes into the hull of a container it belongs to, a line ends at a container's
// anchor, a line ties two bronnen, or the verbinding stays off the canvas. The loaders only
// carry out what this returns. Where they still differ, `mode` names it (code-eenvoud F93).
import { isAmendingRelation, type Relation } from '$lib/vocabulary';
import { isContainerMembership, isContainment, type ContainerKind } from '../container-membership';
import { edgeCategory, type GraphNodeKind } from '../types';

export type Side = 'source' | 'target';

/** One end of a verbinding as the canvas has it when the verbinding comes in. */
export type End = {
	/** The hull its collection is drawn as (a wet, fractie, commissie or dossier), or null. */
	hull: ContainerKind | null;
	/** On the canvas as a bron: the focus, a drawn neighbour, a row, an anchor drawn before. */
	drawn: boolean;
	/** The kind it is drawn as: the source's says whether the semantic threshold counts. */
	kind: GraphNodeKind;
};

/**
 * The loader that asks.
 * - `node`: a neighbour of a node response, beside the bron the response is about (`focus`).
 * - `subgraph`: an edge of a neighbourhood.
 * - `path`: an edge on a path between chosen bronnen: a step to a container ends at its anchor.
 * - `rows`: a row of Verbonden put beside the bron on the canvas (`focus`).
 */
export type Mode = 'node' | 'subgraph' | 'path' | 'rows';

export type Connection = {
	mode: Mode;
	relation: Relation;
	source: End;
	target: End;
	/** `node` and `rows`: the end the response or the rows are about; the other is its neighbour. */
	focus?: Side;
	/** `node`: the neighbour is a container chosen bronnen share, drawn as a point (a netwerk). */
	joins?: boolean;
	confidence?: number | null;
	/** The semantic threshold of the filters. */
	threshold: number;
};

/**
 * - `member`: the other end goes into the hull of the `hull` end; `seat` when the period the
 *   verbinding records counts (a lid's seat), not for a bron "onderdeel van" a container.
 * - `line`: a line from source to target; `meta` when it carries the verbinding's meta.
 * - `none`: nothing drawn.
 * `anchor`: that end, a container, is first drawn as the point its hull is drawn around (and
 * where the line ends).
 */
export type Placement =
	| { place: 'member'; hull: Side; seat: boolean; anchor?: Side }
	| { place: 'line'; meta: boolean; anchor?: Side }
	| { place: 'none'; anchor?: Side };

const other = (side: Side): Side => (side === 'source' ? 'target' : 'source');

export function placeConnection(c: Connection): Placement {
	const { mode, relation, source, target } = c;
	const end = (side: Side) => (side === 'source' ? source : target);
	/** Whether the end is a container that holds the other end by this relation. */
	const holds = (side: Side) => {
		const hull = end(side).hull;
		return !!hull && isContainerMembership(hull, relation);
	};
	/** Whether the end is a wet the other end changes. */
	const changed = (side: Side) => end(side).hull === 'instrument' && isAmendingRelation(relation);

	/**
	 * A line, unless it ends at a container its source is "onderdeel van" (PART_OF): then the
	 * source stands in the hull, wherever the edge comes from (Thijs, 12 Oct).
	 */
	const line = (meta: boolean, anchor?: Side): Placement =>
		target.hull && isContainment(target.hull, relation) && !source.hull
			? { place: 'member', hull: 'target', seat: false, anchor }
			: { place: 'line', meta, anchor };

	if (mode === 'rows') {
		// A row of a container's Verbonden is in its hull (a cabinet's bewindspersonen).
		const focus = c.focus ?? 'source';
		if (holds(focus)) return { place: 'member', hull: focus, seat: true };
		return line(false);
	}

	if (mode === 'node') {
		const near = c.focus ?? 'source';
		const far = other(near);
		// A container chosen bronnen share: a point with a line to each of them.
		if (end(far).hull && c.joins) return line(true, far);
		if (holds(far)) return { place: 'member', hull: far, seat: true };
		if (end(far).drawn && holds(near)) return { place: 'member', hull: near, seat: true };
		// A wet the focus changes: a line to its anchor. A wet that changes the focus (an
		// amending act of an article) is drawn as its anchor alone, without a line.
		if (!end(far).drawn && changed(far))
			return far === 'target' ? line(false, 'target') : { place: 'none', anchor: far };
	} else {
		if (holds('target') && source.drawn) return { place: 'member', hull: 'target', seat: true };
		// A wet a drawn bron changes: a line to its anchor.
		if (source.drawn && changed('target')) return line(false, 'target');
		// On a path every step ties: a stuk that REFERS_TO a chosen wet ends at the wet's hull.
		if (mode === 'path' && target.hull && source.drawn) return line(true, 'target');
		if (mode === 'path' && source.hull && target.drawn) return line(true, 'source');
		if (holds('source') && target.drawn) return { place: 'member', hull: 'source', seat: true };
	}

	if (!source.drawn || !target.drawn) return { place: 'none' };
	const semantic = edgeCategory(relation, source.kind) === 'semantic';
	if (semantic && c.confidence != null && c.confidence < c.threshold) return { place: 'none' };
	return line(true);
}
