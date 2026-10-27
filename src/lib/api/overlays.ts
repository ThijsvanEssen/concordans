import { api, unwrap } from './client';

/** Node id to a count: the open proposed mutations of a bron (in flux). */
export type NodeCounts = Map<string, number>;

const toMap = (counts: { [nodeId: string]: number }): NodeCounts => new Map(Object.entries(counts));

export const getInFlux = async (signal?: AbortSignal): Promise<NodeCounts> =>
	toMap(await unwrap(api.GET('/api/nodes/in-flux', { signal })));
