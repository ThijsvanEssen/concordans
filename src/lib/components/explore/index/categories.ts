import type { Collection } from '$lib/vocabulary';

/** The categories of the index, in the order of the tab strip. The key is the API collection. */
export const INDEX_CATEGORIES = [
	{ key: 'instruments', label: 'Wetten' },
	{ key: 'judgments', label: 'Arresten' },
	{ key: 'dossiers', label: 'Dossiers' },
	{ key: 'committees', label: 'Commissies' },
	{ key: 'members', label: 'Kamerleden' },
	{ key: 'factions', label: 'Fracties' },
	{ key: 'decisions', label: 'Stemmingen' }
] as const satisfies readonly { key: Collection; label: string }[];

export type IndexCategory = (typeof INDEX_CATEGORIES)[number]['key'];
