// Where a verbinding lands on the canvas: one decision for every loader that puts one there
// (a node response, a neighbourhood, the paths between chosen bronnen, rows of Verbonden).
// A bron goes into the hull of a container it belongs to, a line ends at a container's
// anchor, a line ties two bronnen, or the verbinding stays off the canvas. The loaders only
// carry out what this returns, by one rule for all of them: the node response's (code-eenvoud
// F93, Thijs 15 Oct).
import { isAmendingRelation, type Relation } from '$lib/vocabulary';
import { isContainerMembership, isContainment, type ContainerKind } from '../container-membership';
import { edgeCategory, type DrawClass } from '../types';

export type Side = 'source' | 'target';

/** One end of a verbinding as the canvas has it when the verbinding comes in. */
export type End = {
	/** The hull its collection is drawn as (a wet, fractie, commissie or dossier), or null. */
	hull: ContainerKind | null;
	/** On the canvas: a bron, or a container's anchor (the focus, one drawn before). */
	drawn: boolean;
	/** The kind it is drawn as: the source's says whether the semantic threshold counts. */
	drawClass: DrawClass;
	/**
	 * A container the reader chose, or chosen bronnen share: drawn as a point with a line,
	 * not as a hull around the other end (a netwerk's commissie, a step of a path, a row of
	 * Verbonden put on the canvas).
	 */
	ties?: boolean;
};

type Connection = {
	relation: Relation;
	source: End;
	target: End;
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
const SIDES: Side[] = ['target', 'source'];

export function placeConnection(c: Connection): Placement {
	const { relation, source, target } = c;
	const end = (side: Side) => (side === 'source' ? source : target);
	/** The first side, target before source, for which `test` holds with the other end drawn. */
	const sideWhere = (test: (side: Side) => boolean) =>
		SIDES.find((side) => end(other(side)).drawn && test(side));

	/**
	 * A line, unless it ends at a container its source is "onderdeel van" (PART_OF): then the
	 * source stands in the hull, wherever the edge comes from (Thijs, 12 Oct).
	 */
	const line = (meta: boolean, anchor?: Side): Placement =>
		target.hull && isContainment(target.hull, relation) && !source.hull
			? { place: 'member', hull: 'target', seat: false, anchor }
			: { place: 'line', meta, anchor };

	// A container that ties: a point with a line to the bron beside it.
	const ties = sideWhere((side) => !!end(side).hull && !!end(side).ties);
	if (ties) return line(true, ties);
	// A container that holds the other end by this relation: the other end in its hull.
	const holds = sideWhere((side) => {
		const hull = end(side).hull;
		return !!hull && isContainerMembership(hull, relation);
	});
	if (holds) return { place: 'member', hull: holds, seat: true };
	// A wet not on the canvas that a bron changes: a line to its anchor. A wet that changes
	// the bron (an amending act of an article) is drawn as its anchor alone, without a line.
	const changed = sideWhere(
		(side) => !end(side).drawn && end(side).hull === 'instrument' && isAmendingRelation(relation)
	);
	if (changed === 'target') return line(false, 'target');
	if (changed === 'source') return { place: 'none', anchor: 'source' };

	if (!source.drawn || !target.drawn) return { place: 'none' };
	const semantic = edgeCategory(relation, source.drawClass) === 'semantic';
	if (semantic && c.confidence != null && c.confidence < c.threshold) return { place: 'none' };
	return line(true);
}
