// The role of each collection on the canvas, in one table: the kind it is drawn as, the hull
// it is drawn as instead of a bron (a wet, fractie, commissie or dossier; a cabinet holds its
// bewindspersonen as a commissie its leden), whether it is asked and drawn as a neighbour of
// a focus, and its column in a netwerk's first layout (0 parliament, 1 law, 2 judgments).
import { bronLabel, type Collection, type Relation } from '$lib/vocabulary';
import type { ContainerKind } from './container-membership';
import type { GraphNodeKind } from './types';

type Role = {
	kind: GraphNodeKind;
	hull: ContainerKind | null;
	/**
	 * Asked and drawn around a focus. A zaak is the procedure its stukken, activities and
	 * decisions belong to, and as a neighbour would only repeat the dossier's hull; a version
	 * is the reader's, the network is about the current text. Opened as the focus, or put on
	 * the canvas from a panel, a zaak is still drawn.
	 */
	neighbour: boolean;
	column: 0 | 1 | 2;
};

export const COLLECTION_ROLE: Record<Collection, Role> = {
	instruments: { kind: 'instrument', hull: 'instrument', neighbour: true, column: 1 },
	instrument_versions: { kind: 'other', hull: null, neighbour: false, column: 1 },
	articles: { kind: 'article', hull: null, neighbour: true, column: 1 },
	article_versions: { kind: 'other', hull: null, neighbour: false, column: 1 },
	annexes: { kind: 'other', hull: null, neighbour: true, column: 1 },
	judgments: { kind: 'judgment', hull: null, neighbour: true, column: 2 },
	dossiers: { kind: 'dossier', hull: 'dossier', neighbour: true, column: 0 },
	cases: { kind: 'activity', hull: null, neighbour: false, column: 0 },
	documents: { kind: 'document', hull: null, neighbour: true, column: 0 },
	activities: { kind: 'activity', hull: null, neighbour: true, column: 0 },
	decisions: { kind: 'activity', hull: null, neighbour: true, column: 0 },
	commitments: { kind: 'activity', hull: null, neighbour: true, column: 0 },
	members: { kind: 'member', hull: null, neighbour: true, column: 0 },
	factions: { kind: 'faction', hull: 'faction', neighbour: true, column: 0 },
	committees: { kind: 'committee', hull: 'committee', neighbour: true, column: 0 },
	cabinets: { kind: 'committee', hull: 'committee', neighbour: true, column: 0 }
};

/** A hull by the name of the collection it stands for. */
export const GROUP_LABEL: Record<ContainerKind, string> = {
	instrument: bronLabel('instruments'),
	faction: bronLabel('factions'),
	committee: bronLabel('committees'),
	dossier: bronLabel('dossiers')
};

/**
 * Whether the canvas draws a relation as a line. VERSION_OF ties an article to its own
 * versions across time: real, but the reader's version navigation, not the network's.
 */
export const isDrawn = (relation: Relation): boolean => relation !== 'VERSION_OF';

/** The relations to a hull: it groups them, so the legend offers no line to switch. */
const TO_A_HULL = new Set<Relation>(['PART_OF', 'MEMBER_OF', 'LED_BY']);

/** Whether the legend offers a relation as a line to switch on or off. */
export const inLegend = (relation: Relation): boolean =>
	isDrawn(relation) && !TO_A_HULL.has(relation);
