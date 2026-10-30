// The five examples of the lanes canvas (round 3 of the design): neighbourhoods from the API, slimmed
// to the props the scene reads (src/lib/fixtures/lanes). v1: art. 14 and 36702 nr. 2, 3 steps;
// d2: dossier 36702, 2 steps; d1: dossier 36702, 1 step; jw: Jeugdwet, 1 step; v2: dossier 36764
// Cyberbeveiligingswet, 2 steps.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	nodeToGraphNode,
	relationOf,
	type BaseNode,
	type GraphEdge,
	type GraphNode
} from '$lib/graph/types';

export const EXAMPLES = ['v1', 'd2', 'd1', 'jw', 'v2'] as const;

export type Example = (typeof EXAMPLES)[number];

export type ExampleGraph = { nodes: GraphNode[]; edges: GraphEdge[]; chosen: string[] };

type RawEdge = {
	id: string;
	source: string;
	target: string;
	relation: string;
	status: string | null;
};

const cache = new Map<Example, ExampleGraph>();

/** An example as the store would hold it: graph nodes and edges, and the bronnen in focus. */
export function example(name: Example): ExampleGraph {
	const hit = cache.get(name);
	if (hit) return hit;
	const path = join(process.cwd(), 'src/lib/fixtures/lanes', `${name}.json`);
	const raw = JSON.parse(readFileSync(path, 'utf8')) as {
		focus: string[];
		nodes: BaseNode[];
		edges: RawEdge[];
	};
	const graph: ExampleGraph = {
		nodes: raw.nodes.map(nodeToGraphNode).filter((n): n is GraphNode => n !== null),
		edges: raw.edges.flatMap((e) => {
			const relation = relationOf(e.relation);
			return relation ? [{ ...e, relation, label: '', directed: true as const }] : [];
		}),
		chosen: raw.focus
	};
	cache.set(name, graph);
	return graph;
}

/** A fixed reshuffle of a list (a seeded Fisher-Yates), for the guards of determinism. */
export function shuffled<T>(list: readonly T[], seed = 7): T[] {
	const out = [...list];
	let s = seed;
	for (let i = out.length - 1; i > 0; i--) {
		s = (s * 1103515245 + 12345) % 2147483648;
		const j = s % (i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
