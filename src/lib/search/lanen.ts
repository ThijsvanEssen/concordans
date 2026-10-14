// Search answers per lane, side by side, so the fast kinds stand within a few hundred
// milliseconds and the slow ones fill in as they come (prod, 8 Oct: a name 0.1–0.2 s,
// articles and stukken up to 0.6 s, judgments 3–14 s). The kinds in no lane go in the first
// request, which also says what the query cites (`resolve`).
//
// Every request asks in the API's live mode (`mode=live`): within about 250 ms, by name,
// ECLI and title, with `partial` where there is more; the full answer (`mode=full`) on
// "Meer …". The lanes ask with the search client, which waits as long as the API does (30 s).
import type { Collection } from '$lib/vocabulary';

export type Laan = {
	id: string;
	kinds: readonly Collection[];
	/** Its group says "Laden…" while it waits: only the judgments are slow enough. */
	laden: boolean;
};

/** From how many characters a lane is asked: fewer takes the API seconds and says nothing. */
export const LANE_MIN_CHARS = 3;

/** The pause in the typing every request waits for, in ms. */
export const DEBOUNCE_MS = 150;

/** The mode a query is asked in: in full once "Meer …" asked for it, else live. */
export const searchMode = (term: string, fullFor: string): 'live' | 'full' =>
	term === fullFor ? 'full' : 'live';

export const LANEN: readonly Laan[] = [
	{ id: 'tekst', kinds: ['articles', 'documents'], laden: false },
	{ id: 'uitspraken', kinds: ['judgments'], laden: true }
];
