// A focus with hundreds of bronnen of one kind (6:162 BW and its 250 uitspraken) is not
// drawn as hundreds of signs: past CLUSTER_MIN, the bronnen of a kind that hang on the
// focus alone stand on the canvas as one cluster bron, "250 uitspraken". One click on it
// opens a card that shows them all, or the group in Verbonden; shown, they fold back.
import { bronPlural, type Collection } from '$lib/vocabulary';

/** More than this many bronnen of one kind make a cluster. */
export const CLUSTER_MAX_LOOSE = 40;

export const CLUSTER_PREFIX = 'cluster:';
export const clusterId = (collection: Collection) => `${CLUSTER_PREFIX}${collection}`;
export const isClusterId = (id: string) => id.startsWith(CLUSTER_PREFIX);

export type Cluster = {
	id: string;
	collection: Collection;
	members: string[];
	/** The verbinding most of its members have with the focus, for the one line drawn. */
	relation: string;
	/** Whether that line runs from the members to the focus (an uitspraak that cites it). */
	toFocus: boolean;
};

type Node = { id: string; collection: Collection };
type Edge = { source: string; target: string; relation: string };

/** "250 uitspraken": the count and the kind, as the cluster is named. */
export const clusterLabel = (c: Pick<Cluster, 'collection' | 'members'>) =>
	`${c.members.length.toLocaleString('nl-NL')} ${bronPlural(c.collection).toLowerCase()}`;

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
	expanded: ReadonlySet<string>
): Cluster[] {
	if (!focus) return [];
	const collectionOf = new Map(nodes.map((n) => [n.id, n.collection]));
	const ties = new Map<string, Edge[]>();
	for (const e of edges) {
		(ties.get(e.source) ?? ties.set(e.source, []).get(e.source)!).push(e);
		(ties.get(e.target) ?? ties.set(e.target, []).get(e.target)!).push(e);
	}
	const level1 = new Set<string>();
	for (const e of ties.get(focus) ?? []) level1.add(e.source === focus ? e.target : e.source);
	level1.delete(focus);

	const byKind = new Map<Collection, string[]>();
	for (const id of level1) {
		const collection = collectionOf.get(id);
		if (!collection || keep.has(id) || expanded.has(clusterId(collection))) continue;
		// Loose: every verbinding goes to the focus or to a neighbour of the same kind.
		const loose = (ties.get(id) ?? []).every((e) => {
			const other = e.source === id ? e.target : e.source;
			return other === focus || (level1.has(other) && collectionOf.get(other) === collection);
		});
		if (loose) (byKind.get(collection) ?? byKind.set(collection, []).get(collection)!).push(id);
	}

	const clusters: Cluster[] = [];
	for (const [collection, members] of byKind) {
		if (members.length <= CLUSTER_MAX_LOOSE) continue;
		const set = new Set(members);
		const counts = new Map<string, number>();
		for (const id of members) {
			for (const e of ties.get(id) ?? []) {
				if (e.source !== focus && e.target !== focus) continue;
				const key = `${e.relation}|${set.has(e.source) ? 'in' : 'out'}`;
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
		}
		const [top] = [...counts].sort((a, b) => b[1] - a[1]);
		const [relation, way] = (top?.[0] ?? 'RELATED_TO|in').split('|');
		clusters.push({
			id: clusterId(collection),
			collection,
			members,
			relation,
			toFocus: way === 'in'
		});
	}
	return clusters;
}
