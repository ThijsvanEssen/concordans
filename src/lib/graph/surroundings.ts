// The Omgeving of a stuk, a zaak, a stemming, a toezegging or an activiteit: its own neighbours
// from /api/nodes/{collection}/{key}/surroundings (API 0.80.8), never its dossier's members: the
// indieners, the dossier as one bron, the laws it changes or names, its vote, what it answers
// and where it was made (R3-N B13). As rows the canvas draws beside the focus (showRows).
import type { Schema } from '$lib/api/types';
import { isCollection, type Collection, type Relation } from '$lib/vocabulary';
import type { CanvasRow } from './store/types';

type Surroundings = Schema<'SurroundingsResponse'>;
type Node = Schema<'BaseNodeDTO'>;

/** The kinds of bron the API gives surroundings for. */
export const SURROUNDED: ReadonlySet<Collection> = new Set([
	'documents',
	'cases',
	'decisions',
	'commitments',
	'activities'
]);

const rowOf = (node: Node, relation: string, direction: string, proposed = false): CanvasRow[] =>
	isCollection(node.collection)
		? [
				{
					ref: { collection: node.collection, key: node.key },
					title: node.display_name ?? node.key,
					relation: relation as Relation,
					direction: direction === 'outbound' ? 'outbound' : 'inbound',
					proposed,
					props: node.props ?? undefined
				}
			]
		: [];

/**
 * The rows of the surroundings. A stuk names its own vote (`props.decision`): the votes of its
 * zaak on other moties stay out (a zaak in the data holds those of a whole debate).
 */
export function surroundingRows(s: Surroundings): CanvasRow[] {
	const own = typeof s.focal.props?.decision === 'string' ? s.focal.props.decision : null;
	const votes = own ? s.votes.filter((v) => v.node.key === own) : s.votes;
	const section = (x: Surroundings['laws']) =>
		x.items.flatMap((i) => rowOf(i.node, i.relation, i.direction, i.status === 'voorgesteld'));
	return [
		...s.submitters.flatMap((m) => rowOf(m.node, 'AUTHORED', 'inbound')),
		...s.dossiers.flatMap((d) => rowOf(d.node, 'PART_OF', 'outbound')),
		...section(s.laws),
		...votes.flatMap((v) => rowOf(v.node, 'ABOUT', 'inbound')),
		...section(s.follows),
		...section(s.context)
	];
}
