import type { Schema } from './types';
import { api, unwrap } from './client';

/** Node id to a count: the open proposed mutations of a bron (in flux). */
export type NodeCounts = Map<string, number>;

const toMap = (counts: { [nodeId: string]: number }): NodeCounts => new Map(Object.entries(counts));

export const getInFlux = async (signal?: AbortSignal): Promise<NodeCounts> =>
	toMap(await unwrap(api.GET('/api/nodes/in-flux', { signal })));

export type InFluxDossier = Schema<'InFluxDossierDTO'>;

/** At most this many ids in one `/in-flux/dossiers` request. */
const IN_FLUX_IDS_MAX = 500;

/** Node id to its open dossiers (most open changes first): the lopende voorstellen of a bron. */
export type NodeDossiers = Map<string, InFluxDossier[]>;

export const getInFluxDossiers = async (
	ids: readonly string[],
	signal?: AbortSignal
): Promise<NodeDossiers> => {
	const found: NodeDossiers = new Map();
	for (let i = 0; i < ids.length; i += IN_FLUX_IDS_MAX) {
		const answer = await unwrap(
			api.GET('/api/nodes/in-flux/dossiers', {
				params: { query: { ids: ids.slice(i, i + IN_FLUX_IDS_MAX).join(',') } },
				signal
			})
		);
		for (const node of answer.nodes) found.set(node.id, node.dossiers);
	}
	return found;
};
