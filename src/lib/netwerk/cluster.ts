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
			toFocus: way === 'in',
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
	const ties = new Map<string, Edge[]>();
	for (const e of edges) {
		(ties.get(e.source) ?? ties.set(e.source, []).get(e.source)!).push(e);
		(ties.get(e.target) ?? ties.set(e.target, []).get(e.target)!).push(e);
	}
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
		const set = new Set(members);
		const lines = ends.map((end) => {
			const counts = new Map<string, number>();
			for (const m of members)
				for (const e of ties.get(m) ?? []) {
					if (e.source !== end && e.target !== end) continue;
					const key = `${e.relation}|${set.has(e.source) ? 'in' : 'out'}`;
					counts.set(key, (counts.get(key) ?? 0) + 1);
				}
			const [top] = [...counts].sort((a, b) => b[1] - a[1]);
			const [relation, way] = (top?.[0] ?? 'RELATED_TO|in').split('|');
			return { id: end, relation, toEnd: way === 'in' };
		});
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
	const n = (v: number) => v.toLocaleString('nl-NL');
	if (c.ends)
		return [
			namen.length > 0
				? `Elk alleen verbonden met ${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}.`
				: 'Elk alleen verbonden met dezelfde gekozen bronnen.'
		];
	const zinnen = ['Alleen met deze bron verbonden.'];
	const loose = c.neighbours - c.members.length;
	if (loose > 0)
		zinnen.push(
			`${n(loose)} ${loose === 1 ? 'andere staat' : 'andere staan'} los: ook met een andere bron verbonden.`
		);
	if (group?.total && group.total > c.neighbours)
		zinnen.push(
			`In het netwerk: ${n(c.neighbours)} van de ${n(group.total)} ${group.label.charAt(0).toLowerCase()}${group.label.slice(1)}.`
		);
	return zinnen;
}

export type Box = { x: number; y: number; w: number; h: number };

const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Where a cluster's card stands within the canvas (`width` by `height`): beside the
 * pointer, right or left of it, and else beside or below whatever floats over the
 * canvas (the panel Netwerk, the zoom buttons, the legenda), so it covers none of them.
 * Where every place covers something, the place that covers least.
 */
export function placeCard(
	at: { x: number; y: number },
	card: { w: number; h: number },
	canvas: { width: number; height: number },
	obstacles: Box[],
	gap = 16,
	margin = 8
): { x: number; y: number } {
	const clamp = (x: number, y: number): Box => ({
		x: Math.max(margin, Math.min(x, canvas.width - card.w - margin)),
		y: Math.max(margin, Math.min(y, canvas.height - card.h - margin)),
		...card
	});
	const candidates = [
		clamp(at.x + gap, at.y - gap),
		clamp(at.x - gap - card.w, at.y - gap),
		...obstacles.flatMap((o) => [
			clamp(o.x - gap - card.w, at.y - gap),
			clamp(at.x + gap, o.y + o.h + gap),
			clamp(at.x - gap - card.w, o.y + o.h + gap)
		])
	];
	const covered = (b: Box) => obstacles.reduce((sum, o) => sum + overlap(b, o), 0);
	const best = candidates.reduce((a, b) => (covered(b) < covered(a) ? b : a));
	return { x: best.x, y: best.y };
}
