// A bron as the interface holds it, apart from the address it opens at (href.ts): what
// the band and the first paint name a bron by without the page.
import type { Collection } from '$lib/vocabulary';
import { dossierNummer } from './dossier-naam';

/**
 * A bron as the interface holds it: its node key, and for a dossier also its number
 * (`37020-XV`, the node's `label`), which the API takes and a link carries.
 */
export type BronRef =
	| { collection: Exclude<Collection, 'dossiers'>; key: string }
	| { collection: 'dossiers'; key: string; number: string };

/** The ref of a node the API returned; a dossier with its number (dossierNummer). */
export const refOf = (
	collection: Collection,
	key: string,
	props?: Record<string, unknown> | null
): BronRef =>
	collection === 'dossiers'
		? { collection, key, number: dossierNummer(props) ?? '' }
		: { collection, key };
