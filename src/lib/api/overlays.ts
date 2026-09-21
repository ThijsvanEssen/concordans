import { api, unwrap } from './client';

/** Node id to a count: open proposed mutations (in flux) or recent incoming edges (heat). */
export type NodeCounts = Map<string, number>;

const toMap = (counts: { [nodeId: string]: number }): NodeCounts => new Map(Object.entries(counts));

export const getInFlux = async (signal?: AbortSignal): Promise<NodeCounts> =>
	toMap(await unwrap(api.GET('/api/nodes/in-flux', { signal })));

// min_count 2 halves the answer; a count of 1 is barely visible as a halo.
export const getHeat = async (months: number, signal?: AbortSignal): Promise<NodeCounts> =>
	toMap(
		await unwrap(
			api.GET('/api/nodes/heat', { params: { query: { months, min_count: 2 } }, signal })
		)
	);

/** Nodes a single dossier proposes to change, counted per target. */
export async function getDossierInFlux(number: string, signal?: AbortSignal): Promise<NodeCounts> {
	const { edges } = await unwrap(
		api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } }, signal })
	);
	const counts: NodeCounts = new Map();
	for (const { to_id } of edges) if (to_id) counts.set(to_id, (counts.get(to_id) ?? 0) + 1);
	return counts;
}
