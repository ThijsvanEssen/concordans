// The committees of a dossier and the dossiers of a committee (`LED_BY`): no edge holds them,
// the API derives them from the activities a committee leads about the dossier, so the
// neighbourhood (one traversal of the edges) never reaches them. The node response gives them
// in a bucket of its own; the canvas draws them beside the focus (showRows). A committee's
// dossiers come sorted (`sort=importance`, `withLatestFirst`): the latest first, the ones the
// canvas keeps as a bron (`ledFolded`). The committees that only follow a dossier stay out (Thijs, 29 Oct).
import { ignore } from '$lib/api/errors';
import { getNodeGraph, NODE_BUCKET } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import { NODE_TYPES, type Collection } from '$lib/vocabulary';
import type { CanvasRow } from './store/types';
import { rowOf } from './surroundings';

type NodeResponse = Schema<'NodeGraphResponse'>;

/** Per focus kind, the bucket of the other end. */
const OTHER: Partial<
	Record<Collection, { direction: 'inbound' | 'outbound'; collection: Collection }>
> = {
	dossiers: { direction: 'outbound', collection: 'committees' },
	committees: { direction: 'inbound', collection: 'dossiers' }
};

/** The kinds of focus with a derived `LED_BY` bucket. */
export const LED_BY_FOCUS: ReadonlySet<Collection> = new Set(Object.keys(OTHER) as Collection[]);

/**
 * The node response of a committee with its dossiers the latest first: the bucket `LED_BY`
 * of `full` (key order) replaced by one asked `sort=importance`. Another kind, or a failed
 * sorted page, gives `full` as it is. A new response: `full` is shared (`getNode`).
 */
export async function withLatestFirst(
	collection: Collection,
	key: string,
	full: Promise<NodeResponse>
): Promise<NodeResponse> {
	if (collection !== 'committees') return full;
	const other = OTHER[collection]!;
	const [response, sorted] = await Promise.all([
		full,
		getNodeGraph(collection, key, {
			limit: NODE_BUCKET,
			relations: 'LED_BY',
			nodeTypes: NODE_TYPES[other.collection],
			direction: other.direction,
			sort: 'importance'
		}).catch(ignore('Commissie: dossiers, de laatste eerst'))
	]);
	const bucket = sorted && ledBucket(collection, sorted);
	if (!bucket) return response;
	const buckets = response.neighbors.buckets.map((b) =>
		b === ledBucket(collection, response) ? bucket : b
	);
	return { ...response, neighbors: { ...response.neighbors, buckets } };
}

/** The derived `LED_BY` bucket of a dossier or a committee; undefined for another. */
function ledBucket(collection: Collection, response: NodeResponse) {
	const other = OTHER[collection];
	if (!other) return undefined;
	return response.neighbors.buckets.find(
		(b) =>
			b.relation === 'LED_BY' &&
			b.direction === other.direction &&
			b.type === NODE_TYPES[other.collection]
	);
}

/** The rows of the derived `LED_BY` bucket of a dossier or a committee; none for another. */
export function ledByRows(collection: Collection, response: NodeResponse): CanvasRow[] {
	const other = OTHER[collection];
	if (!other) return [];
	return (ledBucket(collection, response)?.items ?? []).flatMap((n) =>
		rowOf(n, 'LED_BY', other.direction).map((row) => ({ ...row, meta: n.meta ?? null }))
	);
}
