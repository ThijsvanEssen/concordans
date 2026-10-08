// Search answers per lane, side by side, so the fast kinds stand within a few hundred
// milliseconds and the slow ones fill in as they come (prod, 8 Oct: a name 0.1–0.2 s,
// articles and stukken up to 0.6 s, judgments 3–14 s). The kinds in no lane go in the first
// request, which also says what the query cites (`resolve`).
import { zoekApi, type api } from '$lib/api/client';
import type { Collection } from '$lib/vocabulary';

export type Laan = {
	id: string;
	kinds: readonly Collection[];
	/** From how many characters it is asked. */
	min: number;
	/** The pause in the typing it waits for, in ms. */
	wacht: number;
	/** Its group says "Laden…" while it waits: only the judgments are slow enough. */
	laden: boolean;
	/** The client it asks with: the slow lanes wait as long as the API does (30 s). */
	client: typeof api;
};

/**
 * The slow lanes wait for a real pause in the typing: the API runs an aborted query to its
 * end, and a part of a word ("zor", "stik") takes it seconds (prod, 8 Oct), so a request per
 * keystroke filled its pool. With the live mode of the API their wait can go down.
 */
export const LANGZAAM_MS = 300;

export const LANEN: readonly Laan[] = [
	// Articles and stukken from three characters: "st" takes the API seconds and says
	// nothing. Judgments from four, until the API has its live mode: "hu" took 11 s, "huur"
	// 6 to 14 s (prod 0.79.9).
	{
		id: 'tekst',
		kinds: ['articles', 'documents'],
		min: 3,
		wacht: LANGZAAM_MS,
		laden: false,
		client: zoekApi
	},
	{
		id: 'uitspraken',
		kinds: ['judgments'],
		min: 4,
		wacht: LANGZAAM_MS,
		laden: true,
		client: zoekApi
	}
];
