// The role of each collection on the canvas, in one table: the kind it is drawn as, the hull
// it is drawn as instead of a bron (a wet, fractie, commissie or dossier; a cabinet holds its
// bewindspersonen as a commissie its leden), whether it is asked and drawn as a neighbour of
// a focus, and its column in a netwerk's first layout (0 parliament, 1 law, 2 judgments).
import { bronLabel, REGULATION_LABEL, type Collection, type Relation } from '$lib/vocabulary';
import type { ContainerKind } from './container-membership';
import type { DrawClass } from './types';

type Role = {
	drawClass: DrawClass;
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
	instruments: { drawClass: 'instrument', hull: 'instrument', neighbour: true, column: 1 },
	instrument_versions: { drawClass: 'other', hull: null, neighbour: false, column: 1 },
	articles: { drawClass: 'article', hull: null, neighbour: true, column: 1 },
	article_versions: { drawClass: 'other', hull: null, neighbour: false, column: 1 },
	annexes: { drawClass: 'other', hull: null, neighbour: true, column: 1 },
	judgments: { drawClass: 'judgment', hull: null, neighbour: true, column: 2 },
	dossiers: { drawClass: 'dossier', hull: 'dossier', neighbour: true, column: 0 },
	cases: { drawClass: 'activity', hull: null, neighbour: false, column: 0 },
	documents: { drawClass: 'document', hull: null, neighbour: true, column: 0 },
	activities: { drawClass: 'activity', hull: null, neighbour: true, column: 0 },
	decisions: { drawClass: 'activity', hull: null, neighbour: true, column: 0 },
	commitments: { drawClass: 'activity', hull: null, neighbour: true, column: 0 },
	members: { drawClass: 'member', hull: null, neighbour: true, column: 0 },
	factions: { drawClass: 'faction', hull: 'faction', neighbour: true, column: 0 },
	committees: { drawClass: 'committee', hull: 'committee', neighbour: true, column: 0 },
	cabinets: { drawClass: 'committee', hull: 'committee', neighbour: true, column: 0 },
	ministries: { drawClass: 'committee', hull: null, neighbour: true, column: 0 }
};

/**
 * A hull by the name of the collection it stands for; the articles' hull of any regeling, as
 * a beleidsregel's articles stand in it too.
 */
export const GROUP_LABEL: Record<ContainerKind, string> = {
	instrument: REGULATION_LABEL,
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
