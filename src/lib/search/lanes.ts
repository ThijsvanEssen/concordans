// Search answers per lane, side by side, so the fast kinds stand within a few hundred
// milliseconds and the slow ones fill in as they come (prod, 8 Oct: a name 0.1–0.2 s,
// articles and stukken up to 0.6 s, judgments 3–14 s). The first lane in scope also says
// what the query cites (`resolve`).
//
// The fast lane asks in the API's live mode (`mode=live`): within about 250 ms, by name,
// ECLI and title, with `partial` where there is more; the full answer (`mode=full`) on
// "Meer …". The text and the judgments, which the live mode never reached in time (29 Oct: cut
// off in 56 of 60 requests, then asked again in full), ask in full at once. The lanes ask with
// the search client, which waits as long as the API does (30 s).
import type { Collection } from '$lib/vocabulary';

/** The kinds the search covers, in the order of the rubrieken (indeling.ts) their groups stand in. */
export const SEARCH_KINDS = [
	'instruments',
	'articles',
	'judgments',
	'dossiers',
	'documents',
	'decisions',
	'commitments',
	'members',
	'factions',
	'committees',
	'cabinets',
	'ministries'
] as const satisfies readonly Collection[];
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type Lane = {
	id: 'fast' | 'text' | 'judgments';
	kinds: readonly SearchKind[];
	/** From how many characters it is asked: fewer takes the API seconds and says nothing. */
	minChars: number;
	/** Its groups say "laden…" while it waits: the lanes that ask in full. */
	showsLoading: boolean;
	/** Asked in full at once, not in the live mode first. */
	full: boolean;
	/**
	 * A newer query aborts its request, which answers in time. Else one request at a time: the
	 * API runs an aborted query to its end, so a newer query waits for the running one.
	 */
	abortsOnRetype: boolean;
	/** Its failure is said in its own group and the others stand; else the search failed. */
	failsAlone: boolean;
	/** Its answer also names the law an abbreviation or a title stands for. */
	namesLaws: boolean;
};

/** The pause in the typing every request waits for, in ms. */
export const DEBOUNCE_MS = 150;

/** The fast kinds from two characters: one says nothing. */
export const FAST_MIN_CHARS = 2;

/** The slower lanes from three characters. */
const LANE_MIN_CHARS = 3;

export const LANES: readonly Lane[] = [
	{
		id: 'fast',
		kinds: [
			'instruments',
			'dossiers',
			'cabinets',
			'ministries',
			'members',
			'commitments',
			'factions',
			'committees',
			'decisions'
		],
		minChars: FAST_MIN_CHARS,
		showsLoading: false,
		full: false,
		abortsOnRetype: true,
		failsAlone: false,
		namesLaws: true
	},
	{
		id: 'text',
		kinds: ['articles', 'documents'],
		minChars: LANE_MIN_CHARS,
		showsLoading: true,
		full: true,
		abortsOnRetype: false,
		failsAlone: true,
		namesLaws: false
	},
	{
		id: 'judgments',
		kinds: ['judgments'],
		minChars: LANE_MIN_CHARS,
		showsLoading: true,
		full: true,
		abortsOnRetype: false,
		failsAlone: true,
		namesLaws: false
	}
];

/** The mode a lane asks a query in: full for a lane that asks so at once, else once "Meer …" asked for it. */
export const searchMode = (
	term: string,
	fullFor: string,
	lane: Pick<Lane, 'full'> = { full: false }
): 'live' | 'full' => (lane.full || term === fullFor ? 'full' : 'live');
