import { SOURCES } from '$lib/nav/sources';
import { bronLabel, bronPlural, type Collection } from '$lib/vocabulary';
import { LIST_PATHS } from '$lib/bron/lists';
import { routeKop } from '$lib/seo/routes';
import { shapeOfCategory } from '$lib/bron/vormen';
import type { SourceTab } from '$lib/nav/SourceTabs.svelte';

// The index in the five rubrieken of the Topbalk (nav/sources.ts), in their order and under their
// names: Wetten, Rechtspraak, Kamerstukken, Parlement, Regering. A category is named as the bron
// is everywhere else (`bronPlural`), and says in one sentence what it holds: the description of
// its address (spa-routes.json), the one a search engine reads.
//
// Bewindspersonen are no collection of their own: they are `members` who held a post in a
// cabinet. Their category has its own key and stands for `members` wherever a bron is meant.

const INDEX_GROUPS = SOURCES.map((s) => ({
	label: s.label,
	keys: s.lists as readonly IndexCategory[]
}));

export type IndexCategory =
	| 'instruments'
	| 'judgments'
	| 'dossiers'
	| 'documents'
	| 'decisions'
	| 'commitments'
	| 'members'
	| 'factions'
	| 'committees'
	| 'cabinets'
	| 'ministries'
	| 'ministers';

const INDEX_CATEGORY_KEYS: readonly IndexCategory[] = INDEX_GROUPS.flatMap((g) => g.keys);

export const isIndexCategory = (value: string | null | undefined): value is IndexCategory =>
	INDEX_CATEGORY_KEYS.some((k) => k === value);

/** The collection a category lists. */
export const collectionOf = (category: IndexCategory): Collection =>
	category === 'ministers' ? 'members' : category;

/** The name of a category, as its tab says it. */
export const categoryLabel = (category: IndexCategory): string =>
	category === 'ministers'
		? 'Bewindspersonen'
		: category === 'members'
			? 'Kamerleden'
			: bronPlural(category);

/** One bron of a category, as the count of its list says it. */
export const categoryNoun = (category: IndexCategory): string =>
	category === 'ministers'
		? 'bewindspersoon'
		: category === 'members'
			? 'kamerlid'
			: bronLabel(collectionOf(category)).toLowerCase();

/** The categories in the order of the tab strip, each with its group. */
export const INDEX_CATEGORIES = INDEX_GROUPS.flatMap((group) =>
	group.keys.map((key) => ({
		key,
		label: categoryLabel(key),
		group: group.label,
		about: routeKop(LIST_PATHS[key]).description
	}))
);

/**
 * What a source holds: its lists, each at `listHref` (IndexView keeps the Kamer), with the
 * pages beside them (Rechtsgang) where they follow. Its tabs, and its rows in Bronnen.
 */
export function sourceParts(
	source: (typeof SOURCES)[number],
	listHref: (category: IndexCategory) => string = (k) => LIST_PATHS[k]
): SourceTab[] {
	const lists: SourceTab[] = INDEX_CATEGORIES.filter((c) => source.lists.includes(c.key)).map(
		(c) => ({
			key: c.key,
			label: c.label,
			href: listHref(c.key),
			about: c.about,
			shape: shapeOfCategory(c.key)
		})
	);
	// Large to small: Kabinetten, Ministeries, Ambten, Bewindspersonen (B148).
	const tabs = [...lists];
	for (const p of source.pages) {
		const after = tabs.findIndex((t) => t.key === p.after);
		const tab = {
			key: p.path,
			label: p.label,
			href: p.path,
			about: routeKop(p.path).description,
			shape: p.shape
		};
		tabs.splice(after < 0 ? tabs.length : after + 1, 0, tab);
	}
	return tabs;
}

/** The tab strip of a source: a source of one list and no page has none (empty). */
export function sourceTabs(
	source: (typeof SOURCES)[number],
	listHref?: (category: IndexCategory) => string
): SourceTab[] {
	const tabs = sourceParts(source, listHref);
	return tabs.length > 1 ? tabs : [];
}
