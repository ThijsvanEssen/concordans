// The committees of a dossier and the dossiers of a committee (`LED_BY`, API 0.80.24): no edge
// holds them, the API derives them from the activities a committee leads about the dossier,
// so the neighbourhood (one traversal of the edges) never reaches them. The node response
// gives them in a bucket of its own; the canvas draws them beside the focus (showRows). The
// committees that only follow a dossier stay out (Thijs, 29 Oct).
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { isCollection, type Collection } from '$lib/vocabulary';
import type { CanvasRow } from './store/types';

type NodeResponse = Schema<'NodeGraphResponse'>;

/** Per focus kind, the bucket of the other end. */
const OTHER: Partial<Record<Collection, { direction: 'inbound' | 'outbound'; type: string }>> = {
	dossiers: { direction: 'outbound', type: 'committee' },
	committees: { direction: 'inbound', type: 'dossier' }
};

/** The kinds of focus with a derived `LED_BY` bucket. */
export const LED_BY_FOCUS: ReadonlySet<Collection> = new Set(Object.keys(OTHER) as Collection[]);

/** The rows of the derived `LED_BY` bucket of a dossier or a committee; none for another. */
export function ledByRows(collection: Collection, response: NodeResponse): CanvasRow[] {
	const other = OTHER[collection];
	if (!other) return [];
	const bucket = response.neighbors.buckets.find(
		(b) => b.relation === 'LED_BY' && b.direction === other.direction && b.type === other.type
	);
	return (bucket?.items ?? []).flatMap((n) =>
		isCollection(n.collection)
			? [
					{
						ref: { collection: n.collection, key: n.key },
						title: naamVanId(n.id, n.display_name),
						relation: 'LED_BY' as const,
						direction: other.direction,
						props: n.props ?? undefined
					}
				]
			: []
	);
}
