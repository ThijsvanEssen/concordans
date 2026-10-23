// A focus with hundreds of bronnen of one kind (6:162 BW and its 250 uitspraken) is not
// drawn as hundreds of signs: past CLUSTER_MAX_LOOSE, the bronnen of a kind that hang on the
// focus alone stand on the canvas as one cluster bron, "250 uitspraken". One click on it
// opens a card that shows them all, or the group in Verbonden; shown, they fold back.
import { joinAnd, lowerFirst, plural } from '$lib/text/words';
import { formatCount } from '$lib/text/getal';
import { bronPlural, type Collection } from '$lib/vocabulary';
import { edgesByNode, mostCommonRelation, pushTo } from '$lib/graph/adjacency';

/** More than this many bronnen of one kind make a cluster. */
export const CLUSTER_MAX_LOOSE = 40;

const CLUSTER_PREFIX = 'cluster:';
const clusterId = (collection: Collection, of = '') => `${CLUSTER_PREFIX}${collection}${of}`;
export const isClusterId = (id: string) => id.startsWith(CLUSTER_PREFIX);

export type Cluster = {
	id: string;
	collection: Collection;
	members: string[];
	/** The verbinding most of its members have with the focus, for the one line drawn. */
	relation: string;
	/** Whether that line runs from the members to the focus (an uitspraak that cites it). */
	toFocus: boolean;
	/** The neighbours of this kind on the canvas, in the cluster or loose beside it. */
	neighbours: number;
	/**
	 * Between the chosen bronnen of a netwerk (`tussenClustersOf`): the chosen bronnen each
	 * member ties, with the verbinding most members have with each. Without: around a focus.
	 */
	ends?: { id: string; relation: string; toEnd: boolean }[];
};

type Node = { id: string; collection: Collection };
type Edge = { source: string; target: string; relation: string };

/** "250 uitspraken": the count and the kind, as the cluster is named. */
export const clusterLabel = (c: Pick<Cluster, 'collection' | 'members'>) =>
	`${formatCount(c.members.length)} ${bronPlural(c.collection).toLowerCase()}`;

/**
 * The clusters around `focus`: per kind, the neighbours tied to nothing but the focus and
 * each other, when there are more than CLUSTER_MAX_LOOSE of them. A bron in `keep` (chosen,
 * pinned, in a hull) is never folded in, nor a kind in `expanded`.
 */
export function clustersOf(
	nodes: readonly Node[],
	edges: readonly Edge[],
	focus: string | null,
	keep: ReadonlySet<string>,
	expanded: ReadonlySet<string>,
	/** Around another chosen bron than the focus: its id, so its clusters are its own. */
	of = ''
): Cluster[] {
	if (!focus) return [];
	const collectionOf = new Map(nodes.map((n) => [n.id, n.collection]));
	const ties = edgesByNode(edges);
	const level1 = new Set<string>();
	for (const e of ties.get(focus) ?? []) level1.add(e.source === focus ? e.target : e.source);
	level1.delete(focus);

	const byKind = new Map<Collection, string[]>();
	for (const id of level1) {
		const collection = collectionOf.get(id);
		if (!collection || keep.has(id) || expanded.has(clusterId(collection, of))) continue;
		// Loose: every verbinding goes to the focus or to a neighbour of the same kind.
		const loose = (ties.get(id) ?? []).every((e) => {
			const other = e.source === id ? e.target : e.source;
			return other === focus || (level1.has(other) && collectionOf.get(other) === collection);
		});
		if (loose) pushTo(byKind, collection, id);
	}

	const clusters: Cluster[] = [];
	for (const [collection, members] of byKind) {
		if (members.length <= CLUSTER_MAX_LOOSE) continue;
		const { relation, toEnd } = mostCommonRelation(new Set(members), ties, focus);
		clusters.push({
			id: clusterId(collection, of),
			collection,
			members,
			relation,
			toFocus: toEnd,
			neighbours: [...level1].filter((id) => collectionOf.get(id) === collection).length
		});
	}
	return clusters;
}

/** More than this many bronnen of one kind between the same chosen bronnen make a cluster. */
export const TUSSEN_MAX_LOOSE = 8;

/**
 * The clusters between the chosen bronnen of a netwerk ("bronnen ertussen"): per kind, the
 * bronnen whose every verbinding goes to the same chosen bronnen, when there are more than
 * TUSSEN_MAX_LOOSE of them. The hundred judgments that cite both HR 24 November 2015 and
 * art. 273f Sr stand as one, "98 uitspraken", with a line to each, not as a fan (UX
 * evaluation of 8 Oct, point 1). A bron in `keep` (in a hull) is never folded in, nor a
 * cluster in `expanded`.
 */
export function tussenClustersOf(
	nodes: readonly Node[],
	edges: readonly Edge[],
	chosen: ReadonlySet<string>,
	keep: ReadonlySet<string>,
	expanded: ReadonlySet<string>
): Cluster[] {
	if (chosen.size < 2) return [];
	const ties = edgesByNode(edges);
	const byEnds = new Map<string, { collection: Collection; ends: string[]; members: string[] }>();
	for (const n of nodes) {
		if (chosen.has(n.id) || keep.has(n.id) || isClusterId(n.id)) continue;
		const own = ties.get(n.id) ?? [];
		if (own.length === 0) continue;
		const ends = new Set<string>();
		let loose = true;
		for (const e of own) {
			const other = e.source === n.id ? e.target : e.source;
			if (!chosen.has(other)) {
				loose = false;
				break;
			}
			ends.add(other);
		}
		if (!loose || ends.size < 2) continue;
		const sorted = [...ends].sort();
		const id = `${CLUSTER_PREFIX}${n.collection}~${sorted.join('+')}`;
		if (expanded.has(id)) continue;
		const at = byEnds.get(id) ?? { collection: n.collection, ends: sorted, members: [] };
		at.members.push(n.id);
		byEnds.set(id, at);
	}

	const clusters: Cluster[] = [];
	for (const [id, { collection, ends, members }] of byEnds) {
		if (members.length <= TUSSEN_MAX_LOOSE) continue;
		const memberIds = new Set(members);
		const lines = ends.map((end) => ({ id: end, ...mostCommonRelation(memberIds, ties, end) }));
		clusters.push({
			id,
			collection,
			members,
			relation: lines[0].relation,
			toFocus: lines[0].toEnd,
			neighbours: members.length,
			ends: lines
		});
	}
	return clusters;
}

/**
 * What the count of a cluster stands for, in sentences for its card. The cluster holds
 * the neighbours of its kind tied to the focus alone; the others of that kind stand loose
 * beside it; the network may hold fewer than the group in Verbonden counts (`group`, the
 * API's total), since it asks for one capped neighbourhood.
 */
export function clusterZinnen(
	c: Pick<Cluster, 'members' | 'neighbours' | 'ends'>,
	group: { label: string; total?: number } | null,
	namen: string[] = []
): string[] {
	const n = formatCount;
	if (c.ends)
		return [
			namen.length > 0
				? `Elk alleen verbonden met ${joinAnd(namen)}.`
				: 'Elk alleen verbonden met dezelfde gekozen bronnen.'
		];
	const zinnen = ['Alleen met deze bron verbonden.'];
	const loose = c.neighbours - c.members.length;
	if (loose > 0)
		zinnen.push(
			`${n(loose)} ${plural(loose, 'andere staat', 'andere staan')} los: ook met een andere bron verbonden.`
		);
	if (group?.total && group.total > c.neighbours)
		zinnen.push(
			`In het netwerk: ${n(c.neighbours)} van de ${n(group.total)} ${lowerFirst(group.label)}.`
		);
	return zinnen;
}
