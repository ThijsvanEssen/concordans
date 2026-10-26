import { bronLabel, bronPlural, type Collection } from '$lib/vocabulary';

// The index in four groups: the law and the courts; how the Kamer deals with a subject;
// who does it in the Kamer; who does it in the government. A category is named as the bron
// is everywhere else (`bronPlural`), and says in one sentence what it holds.
//
// Bewindspersonen are no collection of their own: they are `members` who held a post in a
// cabinet. Their category has its own key and stands for `members` wherever a bron is meant.

type Group = { label: string; keys: readonly (Collection | 'ministers')[] };

const INDEX_GROUPS = [
	{ label: 'Recht', keys: ['instruments', 'judgments'] },
	{ label: 'Parlementaire behandeling', keys: ['dossiers', 'decisions', 'documents'] },
	{ label: 'Parlement', keys: ['members', 'factions', 'committees'] },
	{ label: 'Regering', keys: ['cabinets', 'ministries', 'ministers', 'commitments'] }
] as const satisfies readonly Group[];

export type IndexCategory = (typeof INDEX_GROUPS)[number]['keys'][number];

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

const ABOUT: Record<IndexCategory, string> = {
	instruments:
		'Wetten, verdragen en Europese regelgeving, en de publicaties in het Staatsblad die ze wijzigen.',
	judgments: 'Uitspraken van de rechter, met de artikelen die ze aanhalen.',
	dossiers:
		'Kamerdossiers: wetsvoorstellen, begrotingen, verdragen en andere onderwerpen, met hun stukken, behandeling en uitkomst.',
	decisions:
		'Stemmingen van de Tweede Kamer en de Eerste Kamer over wetsvoorstellen, moties en amendementen, met de stemmen per fractie of per lid.',
	documents:
		'Stukken van de Tweede Kamer en de Eerste Kamer: brieven, verslagen, moties, amendementen en wetsvoorstellen, met hun plaats in het dossier.',
	members: 'Leden van de Tweede Kamer en de Eerste Kamer, met hun fractie en commissies.',
	factions: 'Fracties in de Tweede Kamer en de Eerste Kamer, met hun zetels en leden.',
	committees: 'Commissies van de Tweede Kamer en de Eerste Kamer, met hun leden en activiteiten.',
	cabinets: 'Kabinetten, met hun periode, coalitie en bewindspersonen.',
	ministries:
		'Ministeries, met hun periode en het ministerie dat hen opvolgde.',
	ministers:
		'Ministers en staatssecretarissen per kabinet en ministerie, met de dossiers die ze als bewindspersoon ondertekenden.',
	commitments:
		'Toezeggingen van bewindspersonen aan de Kamer, met hun stand en de dossiers waarop ze betrekking hebben.'
};

/** The categories in the order of the tab strip, each with its group. */
export const INDEX_CATEGORIES = INDEX_GROUPS.flatMap((group) =>
	group.keys.map((key) => ({
		key: key as IndexCategory,
		label: categoryLabel(key),
		group: group.label,
		about: ABOUT[key as IndexCategory]
	}))
);

/** The tab strip: each group with its categories, in order. */
export const INDEX_TABS = INDEX_GROUPS.map((group) => ({
	label: group.label,
	categories: INDEX_CATEGORIES.filter((c) => c.group === group.label)
}));
