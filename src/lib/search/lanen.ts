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
	/**
	 * Asked per keystroke in the API's live mode (`mode=live`, Back-end #1): within about
	 * 250 ms, by name, ECLI and title, with `partial` where there is more; the full answer
	 * (`mode=full`) on "Meer uitspraken". An API without the mode ignores it.
	 */
	live: boolean;
};

/**
 * The switch for the API's live mode on every lane (API 0.79.12, Back-end #1 #303): no
 * ranking, the start of a word from three characters, 250 ms per type with `partial` where
 * there is more. On, every lane asks per keystroke in that mode, the waits go down and
 * judgments come from three characters. Off, the slow lanes wait for a real pause: the API
 * without it runs an aborted query to its end, and a part of a word ("zor", "stik") took it
 * seconds (prod, 8 Oct). Set it once the live mode is measured on prod.
 */
export const LIVE = true;

/** The pause in the typing the fast lane waits for. */
export const DEBOUNCE_MS = LIVE ? 150 : 250;
/** The pause the slow lanes wait for. */
export const LANGZAAM_MS = LIVE ? 150 : 300;

export const LANEN: readonly Laan[] = [
	// Articles and stukken from three characters: "st" takes the API seconds and says
	// nothing. Judgments from four without the live mode: "hu" took 11 s, "huur" 6 to 14 s
	// (prod 0.79.9).
	{
		id: 'tekst',
		kinds: ['articles', 'documents'],
		min: 3,
		wacht: LANGZAAM_MS,
		laden: false,
		client: zoekApi,
		live: LIVE
	},
	{
		id: 'uitspraken',
		kinds: ['judgments'],
		min: LIVE ? 3 : 4,
		wacht: LANGZAAM_MS,
		laden: true,
		client: zoekApi,
		live: true
	}
];
