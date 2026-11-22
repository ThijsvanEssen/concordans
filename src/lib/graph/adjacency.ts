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
