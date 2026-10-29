// A focus with hundreds of bronnen of one kind (6:162 BW and its 250 uitspraken) is not
// drawn as hundreds of signs: past CLUSTER_MAX_LOOSE, the bronnen of a kind that hang on the
// focus alone stand on the canvas as one cluster bron, "250 uitspraken". One click on it
// opens a card that shows them all, or the group in Verbonden; shown, they fold back.
import { joinAnd } from '$lib/text/words';
import { formatCount } from '$lib/text/getal';
import type { Collection } from '$lib/vocabulary';
import { sortLabel, sortOf } from '$lib/bron/rubrieken';
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
	/** Some members tie to another neighbour of the focus too (an uitspraak that cites an article beside it). */
	alsoTied?: boolean;
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
	`${formatCount(c.members.length)} ${sortLabel(sortOf(c.collection, '', null)).toLowerCase()}`;

/**
 * The heading of a cluster's card: of how many it holds where there are more (N2): "200 van
 * 63.600 stemmingen", the whole as the legend counts it.
 */
export const clusterHeading = (
	c: Pick<Cluster, 'collection' | 'members'>,
	totaal: number | null
) =>
	totaal != null && totaal > c.members.length
		? `${formatCount(c.members.length)} van ${formatCount(totaal)} ${sortLabel(sortOf(c.collection, '', null)).toLowerCase()}`
		: clusterLabel(c);

/**
 * The clusters around `focus`: per kind, the neighbours tied to nothing but the focus and its
 * other neighbours, when there are more than CLUSTER_MAX_LOOSE of them. The 137 uitspraken
 * that cite HR BH2815 and articles beside it are one cluster too, not 137 signs (UX review
 * N4): the articles stay drawn, with their own line to the focus. A bron tied to a bron
 * further away stays drawn. A bron in `keep` (chosen, pinned, in a hull) is never folded in,
 * nor a kind in `expanded`.
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
	const alsoTied = new Set<Collection>();
	for (const id of level1) {
		const collection = collectionOf.get(id);
		if (!collection || keep.has(id) || expanded.has(clusterId(collection, of))) continue;
		// Loose: every verbinding goes to the focus or to another of its neighbours.
		const others = (ties.get(id) ?? []).map((e) => (e.source === id ? e.target : e.source));
		if (!others.every((o) => o === focus || level1.has(o))) continue;
		pushTo(byKind, collection, id);
		if (others.some((o) => o !== focus && collectionOf.get(o) !== collection))
			alsoTied.add(collection);
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
			neighbours: [...level1].filter((id) => collectionOf.get(id) === collection).length,
			alsoTied: alsoTied.has(collection)
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
 * The one label a cluster's card carries beside its heading: with which chosen bronnen the
 * members are tied (a cluster between several), `Verbonden met Gemw en Boek 6 BW`. A cluster of
 * one focus has none; its heading says how many (`clusterHeading`).
 */
export function clusterBinding(c: Pick<Cluster, 'ends'>, namen: string[] = []): string | null {
	if (!c.ends) return null;
	return namen.length > 0 ? `Verbonden met ${joinAnd(namen)}` : 'Verbonden met dezelfde bronnen';
}

/**
 * The lines that end in a folded bron, led to its cluster: one line from rand to rand, as
 * the Netwerkcanvas draws it. Lines between the same pair are one (the verbinding most of
 * them have); a line inside one cluster, or to the bron the cluster hangs on (which has its
 * own line already, `anchors`), is dropped.
 */
export function edgesToClusters<E extends Edge & { id: string }>(
	edges: readonly E[],
	clusters: readonly Pick<Cluster, 'id' | 'members' | 'ends'>[],
	anchors: ReadonlyMap<string, readonly string[]> = new Map()
): Edge[] {
	const home = new Map<string, string>();
	for (const c of clusters) for (const m of c.members) home.set(m, c.id);
	const anchorsOf = (c: string) =>
		new Set([
			...(anchors.get(c) ?? []),
			...(clusters.find((x) => x.id === c)?.ends ?? []).map((e) => e.id)
		]);
	const pairs = new Map<string, { source: string; target: string; relations: string[] }>();
	for (const e of edges) {
		const from = home.get(e.source);
		const to = home.get(e.target);
		if (!from && !to) continue;
		if (from === to) continue;
		if (from && anchorsOf(from).has(e.target)) continue;
		if (to && anchorsOf(to).has(e.source)) continue;
		const source = from ?? e.source;
		const target = to ?? e.target;
		const key = `${source}~${target}`;
		const pair = pairs.get(key) ?? { source, target, relations: [] };
		pair.relations.push(e.relation);
		pairs.set(key, pair);
	}
	return [...pairs.entries()].map(([key, p]) => {
		const tally = new Map<string, number>();
		for (const r of p.relations) tally.set(r, (tally.get(r) ?? 0) + 1);
		const relation = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
		return { id: `via:${key}`, source: p.source, target: p.target, relation };
	});
}
