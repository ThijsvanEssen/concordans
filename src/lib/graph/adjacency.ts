// What ties the bronnen of a graph to each other, read from its edges.

type Edge = { source: string; target: string };

/** Adds `value` to the list at `key`, starting the list when there is none. */
export function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}

/** Per node, the nodes an edge ties it to, either way. */
export function neighbours(edges: Iterable<Edge>): Map<string, string[]> {
	const next = new Map<string, string[]>();
	for (const e of edges) {
		pushTo(next, e.source, e.target);
		pushTo(next, e.target, e.source);
	}
	return next;
}

/** Per node, the edges that touch it. */
export function edgesByNode<E extends Edge>(edges: Iterable<E>): Map<string, E[]> {
	const ties = new Map<string, E[]>();
	for (const e of edges) {
		pushTo(ties, e.source, e);
		pushTo(ties, e.target, e);
	}
	return ties;
}

/**
 * The relation most of `members` have with `end` (their `ties` from `edgesByNode`), and
 * whether it runs from the members to the end; RELATED_TO toward the end without one.
 */
export function mostCommonRelation(
	members: ReadonlySet<string>,
	ties: ReadonlyMap<string, readonly (Edge & { relation: string })[]>,
	end: string
): { relation: string; toEnd: boolean } {
	const counts = new Map<string, { relation: string; toEnd: boolean; count: number }>();
	for (const id of members) {
		for (const e of ties.get(id) ?? []) {
			if (e.source !== end && e.target !== end) continue;
			const toEnd = members.has(e.source);
			const key = `${e.relation}|${toEnd}`;
			const at = counts.get(key) ?? { relation: e.relation, toEnd, count: 0 };
			at.count += 1;
			counts.set(key, at);
		}
	}
	const [top] = [...counts.values()].sort((a, b) => b.count - a.count);
	return top
		? { relation: top.relation, toEnd: top.toEnd }
		: { relation: 'RELATED_TO', toEnd: true };
}
