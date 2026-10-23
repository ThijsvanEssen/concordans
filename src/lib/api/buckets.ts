// A bucket of a node response by its relation, direction and collection: read by the band
// "Behoort bij" and by the first paint, which has no client.
import type { NodeGraph } from './nodes';

/** The bucket of one relation, direction and collection in a node response, where it has one. */
export const findBucket = (
	response: NodeGraph | null | undefined,
	b: { relation: string; direction: string; collection: string }
) =>
	response?.neighbors.buckets?.find(
		(x) => x.relation === b.relation && x.direction === b.direction && x.collection === b.collection
	);
