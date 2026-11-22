// The role of each collection on the canvas, in one table: the kind it is drawn as, the hull
// it is drawn as instead of a bron (a wet, fractie, commissie or dossier; a cabinet holds its
// bewindspersonen as a commissie its leden, in a hull of its own), whether it is asked and drawn as a neighbour of
// a focus.
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
	/**
	 * The hull it is drawn as when it is the focus or chosen, where it has none as a neighbour:
	 * a ministerie holds its bewindspersonen and toezeggingen then (UX review N5), but a wet or
	 * a dossier it leads does not go into a hull of it.
	 */
	focusHull?: ContainerKind;
};

export const COLLECTION_ROLE: Record<Collection, Role> = {
	instruments: { drawClass: 'instrument', hull: 'instrument', neighbour: true },
	instrument_versions: { drawClass: 'other', hull: null, neighbour: false },
	articles: { drawClass: 'article', hull: null, neighbour: true },
	article_versions: { drawClass: 'other', hull: null, neighbour: false },
	annexes: { drawClass: 'other', hull: null, neighbour: true },
	judgments: { drawClass: 'judgment', hull: null, neighbour: true },
	dossiers: { drawClass: 'dossier', hull: 'dossier', neighbour: true },
	cases: { drawClass: 'activity', hull: null, neighbour: false },
	documents: { drawClass: 'document', hull: null, neighbour: true },
	activities: { drawClass: 'activity', hull: null, neighbour: true },
	decisions: { drawClass: 'activity', hull: null, neighbour: true },
	commitments: { drawClass: 'activity', hull: null, neighbour: true },
	members: { drawClass: 'member', hull: null, neighbour: true },
	factions: { drawClass: 'faction', hull: 'faction', neighbour: true },
	committees: { drawClass: 'committee', hull: 'committee', neighbour: true },
	cabinets: { drawClass: 'cabinet', hull: 'cabinet', neighbour: true },
	ministries: {
		drawClass: 'cabinet',
		hull: null,
		focusHull: 'cabinet',
		neighbour: true
	}
};

/**
 * A hull by the name of the collection it stands for; the articles' hull of any regeling, as
 * a beleidsregel's articles stand in it too.
 */
export const GROUP_LABEL: Record<ContainerKind, string> = {
	instrument: REGULATION_LABEL,
	faction: bronLabel('factions'),
	committee: bronLabel('committees'),
	cabinet: bronLabel('cabinets'),
	dossier: bronLabel('dossiers')
};

/**
 * Whether the canvas draws a relation as a line. VERSION_OF ties an article to its own
 * versions across time: real, but the reader's version navigation, not the network's.
 */
export const isDrawn = (relation: Relation): boolean => relation !== 'VERSION_OF';
