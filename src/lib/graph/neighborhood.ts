// A neighbourhood without the detour through a law. Two steps from an article lead
// through its law (PART_OF) to every other article of it: art. 126ffa Sv came with 193
// Sv articles that share nothing with it but the law, the API's cap of 200 was full of
// them, and the article's own verbindingen (a judgment, three articles it refers to) were
// lost among them in one hull. Only the bronnen within the depth along other verbindingen
// stay; the law itself is still a step away, as the hull its articles stand in.

type Node = { id: string; collection: string };
type Edge = { source: string; target: string; relation: string | null };

/**
 * The part of `nodes` and `edges` reachable from `focal` within `depth` steps without
 * stepping through a law (PART_OF to an instrument), unless the law is the focus.
 */
export function withoutLawHops<N extends Node, E extends Edge>(
	nodes: readonly N[],
	edges: readonly E[],
	focal: string,
	depth: number
): { nodes: N[]; edges: E[] } {
	const collection = new Map(nodes.map((n) => [n.id, n.collection]));
	const throughLaw = (e: Edge) =>
		e.relation === 'PART_OF' && collection.get(e.target) === 'instruments' && e.target !== focal;
	const next = new Map<string, string[]>();
	const link = (a: string, b: string) => (next.get(a) ?? next.set(a, []).get(a)!).push(b);
	for (const e of edges) {
		if (throughLaw(e)) continue;
		link(e.source, e.target);
		link(e.target, e.source);
	}
	const steps = new Map<string, number>([[focal, 0]]);
	const queue = [focal];
	while (queue.length) {
		const id = queue.shift()!;
		const step = steps.get(id)!;
		if (step >= depth) continue;
		for (const other of next.get(id) ?? []) {
			if (steps.has(other)) continue;
			steps.set(other, step + 1);
			queue.push(other);
		}
	}
	// The laws of what stays: not drawn as bronnen, but the hulls they stand for.
	const laws = new Set(
		edges.filter((e) => throughLaw(e) && steps.has(e.source)).map((e) => e.target)
	);
	const keep = (id: string) => steps.has(id) || laws.has(id);
	return {
		nodes: nodes.filter((n) => keep(n.id)),
		edges: edges.filter((e) => keep(e.source) && keep(e.target))
	};
}
