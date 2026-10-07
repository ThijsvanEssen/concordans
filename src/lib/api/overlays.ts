import { api, unwrap } from './client';
import { inPool } from './pool';

/** Node id to a count: open proposed mutations (in flux) or recent incoming edges (heat). */
export type NodeCounts = Map<string, number>;

const toMap = (counts: { [nodeId: string]: number }): NodeCounts => new Map(Object.entries(counts));

export const getInFlux = async (signal?: AbortSignal): Promise<NodeCounts> =>
	toMap(await unwrap(api.GET('/api/nodes/in-flux', { signal })));

/** The most ids one heat request takes (API 0.79.3). */
export const HEAT_IDS_MAX = 500;
/**
 * The most characters of ids in one request: 500 ids are some 15 kB of address, more
 * than a proxy takes in a request line (nginx: 8 kB). Encoded, a slash is three.
 */
export const HEAT_IDS_CHARS = 6000;

/** The ids in portions a request takes: at most HEAT_IDS_MAX, at most HEAT_IDS_CHARS. */
export function heatPortions(ids: readonly string[]): string[][] {
	const portions: string[][] = [];
	let portion: string[] = [];
	let chars = 0;
	for (const id of ids) {
		const size = encodeURIComponent(id).length + 3;
		if (portion.length && (portion.length >= HEAT_IDS_MAX || chars + size > HEAT_IDS_CHARS)) {
			portions.push(portion);
			portion = [];
			chars = 0;
		}
		portion.push(id);
		chars += size;
	}
	if (portion.length) portions.push(portion);
	return portions;
}

/**
 * The heat of the bronnen `ids`, the ones drawn: in portions (`heatPortions`), two at a time
 * (API 0.79.3).
 * The whole map was about 1 MB on small and every node in production; without ids the
 * API now gives its top 10.000. min_count 2 halves the answer; a count of 1 is barely
 * visible as a halo.
 */
export async function getHeat(
	months: number,
	ids: readonly string[],
	signal?: AbortSignal
): Promise<NodeCounts> {
	const answers = await inPool(
		heatPortions(ids),
		(portion) =>
			unwrap(
				api.GET('/api/nodes/heat', {
					params: { query: { months, min_count: 2, ids: portion.join(',') } },
					signal
				})
			),
		{ parallel: 2 }
	);
	return new Map(answers.flatMap((counts) => [...toMap(counts)]));
}

/** Nodes a single dossier proposes to change, counted per target. */
export async function getDossierInFlux(number: string, signal?: AbortSignal): Promise<NodeCounts> {
	const { edges } = await unwrap(
		api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } }, signal })
	);
	const counts: NodeCounts = new Map();
	for (const { to_id } of edges) if (to_id) counts.set(to_id, (counts.get(to_id) ?? 0) + 1);
	return counts;
}
