// A neighbourhood without detours: what the focus reaches along its own verbindingen, not
// what merely shares a law or a person with it.
//
// Through a law. Two steps from an article lead through its law (PART_OF) to every other
// article of it: art. 126ffa Sv came with 193 Sv articles that share nothing with it but the
// law, the API's cap of 200 was full of them, and the article's own verbindingen (a judgment,
// three articles it refers to) were lost among them in one hull. The law itself is still a
// step away, as the hull its articles stand in. What became of an old article (TRANSPOSED_TO
// the new law) is no step at all: the new law would bring some 1.300 old articles along.
//
// Through a person or a body. Two steps from a motie lead through its indiener (AUTHORED) to
// every stemming the lid cast and every stuk the lid signed: the motie 36799 nr. 31 showed
// the asylum votes of July 2025 its indiener took part in (productcheck 0.80, punt 3). The API
// stops its walk at a lid, fractie, commissie or kabinet (`stop_at=ACTORS`, 0.80.1, #871):
// it draws them, with the fractie or kabinet a lid sits in, and reaches nothing through them.

import { isTranspositionOutcome, type Collection } from '$lib/vocabulary';
import { edgesByNode } from './adjacency';

type Node = { id: string; collection: string };
type Edge = { source: string; target: string; relation: string | null };

/** The persons and bodies of parliament and government: hubs, never a way through. */
export const ACTORS: readonly Collection[] = [
	'members',
	'factions',
	'committees',
	'cabinets',
	'ministries'
];

/**
 * The part of `nodes` and `edges` reachable from `focal` within `depth` steps without a
 * detour: not through a law (PART_OF to an instrument), unless the law is the focus, and
 * without what became of an old article (`isTranspositionOutcome`). An edge between two
 * bronnen that stay is kept, whichever way they were reached.
 */
export function withoutDetours<N extends Node, E extends Edge>(
	nodes: readonly N[],
	edges: readonly E[],
	focal: string,
	depth: number
): { nodes: N[]; edges: E[] } {
	const collection = new Map(nodes.map((n) => [n.id, n.collection]));
	const throughLaw = (e: Edge) =>
		e.relation === 'PART_OF' && collection.get(e.target) === 'instruments' && e.target !== focal;
	const outcome = (e: Edge) => isTranspositionOutcome(e.relation, collection.get(e.target));
	const walked = edges.filter((e) => !outcome(e));
	const ties = edgesByNode(walked.filter((e) => !throughLaw(e)));
	const steps = new Map<string, number>([[focal, 0]]);
	const queue = [focal];
	while (queue.length) {
		const id = queue.shift()!;
		const step = steps.get(id)!;
		if (step >= depth) continue;
		for (const e of ties.get(id) ?? []) {
			const other = e.source === id ? e.target : e.source;
			if (steps.has(other)) continue;
			steps.set(other, step + 1);
			queue.push(other);
		}
	}
	// The laws of what stays: not drawn as bronnen, but the hulls they stand for.
	const laws = new Set(
		walked.filter((e) => throughLaw(e) && steps.has(e.source)).map((e) => e.target)
	);
	const keep = (id: string) => steps.has(id) || laws.has(id);
	return {
		nodes: nodes.filter((n) => keep(n.id)),
		edges: walked.filter((e) => keep(e.source) && keep(e.target))
	};
}
