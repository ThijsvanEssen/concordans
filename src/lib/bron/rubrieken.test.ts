// The five soorten are the five rubrieken of the Topbalk, and every bron falls in the same one
// wherever it is shown: colour, shape, Tonen, Filter Soort, Verbonden, Bladeren, the Topbalk and
// the keten. One table, the table of systematiek.md (A292) with the decisions of A296: a toezegging
// stands with the Kamerstukken, Kamerleden with Parlement, bewindspersonen with Regering.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';
import { kindColour } from '$lib/bron/kleur';
import { bronPlural, type Collection } from '$lib/vocabulary';
import { INDEX_CATEGORIES } from '$lib/components/explore/index/categories';
import { SOURCES, sourceOfCollection } from '$lib/nav/sources';
import { SEARCH_KINDS } from '$lib/search/lanes';
import { groupLabel } from '$lib/search/present';
import { chain } from '$lib/network/chain';
import { lineage } from '$lib/network/lineage';
import { clusterHeading, clustersOf, CLUSTER_MAX_LOOSE } from '$lib/selection/cluster';
import { kindRowCount, type KindRow } from '$lib/components/graph/kind-rows';
import { FILTER_GROUP_LABEL, FILTER_GROUPS, filterGroupOf } from '$lib/verbonden/filter';
import { SOORT_LABEL, kindLabelOn, kindOfBron, kindsOf } from '$lib/verbonden/summary';
import type { Group } from '$lib/verbonden/groups';
import type { Row } from '$lib/verbonden/rows';
import {
	RUBRIEK_LABEL,
	rubriekColour,
	rubriekOf,
	rubriekOfSort,
	sortLabel,
	sortOne,
	sortsFrom,
	type Rubriek,
	type Sort
} from './rubrieken';
import { SORT_SHAPE, VORMEN, vormVanBron, type Vorm } from './vormen';

type Bron = {
	/** What it is called in the table of systematiek.md. */
	naam: string;
	collection: Collection;
	key: string;
	props?: Record<string, unknown>;
	relation?: string;
	rubriek: Rubriek;
	sort: Sort;
	/** The name of its soort, as every place says it. */
	label: string;
	vorm: Vorm;
	/** The list of Bladeren it has, none where the data has no list for it. */
	lijst: string | null;
	/** Whether the Tabbalk names its soort under the rubriek. */
	bevat: boolean;
	/** The layer of its keten, where it has one: the name of its soort in the singular. */
	laag?: string;
};

const POST = [{ function: 'Minister van Justitie', cabinet: 'kabinet-Rutte IV' }];

/** The table: every kind of bron of systematiek.md, in the order of the rubrieken. */
const BRONNEN_TABEL: Bron[] = [
	{
		naam: 'wet',
		collection: 'instruments',
		key: 'bwbr0005289',
		rubriek: 'wetten',
		sort: 'wetten',
		label: 'Wetten',
		vorm: 'regel',
		lijst: 'instruments',
		bevat: true,
		laag: 'Wet'
	},
	{
		naam: 'regeling',
		collection: 'instruments',
		key: 'bwbr0010346',
		props: { kind: 'ministeriele-regeling' },
		rubriek: 'wetten',
		sort: 'wetten',
		label: 'Wetten',
		vorm: 'regel',
		lijst: 'instruments',
		bevat: true
	},
	{
		naam: 'EU-handeling',
		collection: 'instruments',
		key: '32016r0679',
		props: { celex: '32016R0679', jurisdiction: 'eu' },
		rubriek: 'wetten',
		sort: 'internationaal',
		label: 'Europees en internationaal',
		vorm: 'regel-int',
		lijst: 'instruments',
		bevat: false
	},
	{
		naam: 'artikel',
		collection: 'articles',
		key: 'bwbr0005289_6_162',
		rubriek: 'wetten',
		sort: 'artikelen',
		label: 'Artikelen',
		vorm: 'regel-o',
		lijst: null,
		bevat: true,
		laag: 'Artikel'
	},
	{
		naam: 'bijlage',
		collection: 'annexes',
		key: 'bwbr0005289_bijlage_1',
		rubriek: 'wetten',
		sort: 'artikelen',
		label: 'Artikelen',
		vorm: 'regel-o',
		lijst: null,
		bevat: true
	},
	{
		naam: 'uitspraak',
		collection: 'judgments',
		key: 'ecli_nl_hr_2019_2006',
		props: { tier: 'hoge_raad' },
		rubriek: 'rechtspraak',
		sort: 'uitspraken',
		label: 'Uitspraken',
		vorm: 'uitspraak',
		lijst: 'judgments',
		bevat: false,
		laag: 'Hoge Raad'
	},
	{
		naam: 'dossier',
		collection: 'dossiers',
		key: '36764',
		rubriek: 'kamerstukken',
		sort: 'dossiers',
		label: 'Dossiers',
		vorm: 'dossier',
		lijst: 'dossiers',
		bevat: true
	},
	{
		naam: 'stuk',
		collection: 'documents',
		key: 'kst_36764_2',
		props: { kind: 'Brief regering' },
		rubriek: 'kamerstukken',
		sort: 'stukken',
		label: 'Stukken',
		vorm: 'stuk',
		lijst: 'documents',
		bevat: true
	},
	{
		naam: 'wetsvoorstel',
		collection: 'documents',
		key: 'kst_36764_2',
		props: { kind: 'Voorstel van wet' },
		rubriek: 'kamerstukken',
		sort: 'stukken',
		label: 'Stukken',
		vorm: 'voorstel',
		lijst: 'documents',
		bevat: true
	},
	{
		naam: 'stemming',
		collection: 'decisions',
		key: 'decision_c94c4b61',
		rubriek: 'kamerstukken',
		sort: 'stemmingen',
		label: 'Stemmingen',
		vorm: 'besluit',
		lijst: 'decisions',
		bevat: true
	},
	{
		naam: 'activiteit',
		collection: 'activities',
		key: '2026A03119',
		rubriek: 'kamerstukken',
		sort: 'activiteiten',
		label: 'Activiteiten',
		vorm: 'activiteit',
		lijst: null,
		bevat: true
	},
	{
		naam: 'toezegging',
		collection: 'commitments',
		key: 'tz202604_068',
		rubriek: 'kamerstukken',
		sort: 'toezeggingen',
		label: 'Toezeggingen',
		vorm: 'toezegging',
		lijst: 'commitments',
		bevat: true
	},
	{
		naam: 'Kamerlid',
		collection: 'members',
		key: 'rob_jetten',
		props: { name: 'Rob Jetten', party: 'D66', faction_memberships: [{ faction: 'd66' }] },
		rubriek: 'parlement',
		sort: 'kamerleden',
		label: 'Kamerleden',
		vorm: 'persoon',
		lijst: 'members',
		bevat: true,
		laag: 'Kamerlid'
	},
	{
		naam: 'fractie',
		collection: 'factions',
		key: 'd66',
		rubriek: 'parlement',
		sort: 'fracties',
		label: 'Fracties',
		vorm: 'orgaan',
		lijst: 'factions',
		bevat: true,
		laag: 'Fractie'
	},
	{
		naam: 'commissie',
		collection: 'committees',
		key: 'j_v',
		rubriek: 'parlement',
		sort: 'commissies',
		label: 'Commissies',
		vorm: 'orgaan-o',
		lijst: 'committees',
		bevat: true,
		laag: 'Commissie'
	},
	{
		naam: 'kabinet',
		collection: 'cabinets',
		key: 'rutte_iv',
		rubriek: 'regering',
		sort: 'kabinetten',
		label: 'Kabinetten',
		vorm: 'kabinet',
		lijst: 'cabinets',
		bevat: true,
		laag: 'Kabinet'
	},
	{
		naam: 'ministerie',
		collection: 'ministries',
		key: 'jenv',
		rubriek: 'regering',
		sort: 'ministeries',
		label: 'Ministeries',
		vorm: 'ministerie',
		lijst: 'ministries',
		bevat: true
	},
	{
		naam: 'bewindspersoon',
		collection: 'members',
		key: 'f3b1e0b3',
		props: { name: 'A. Aboutaleb', government_functions: POST },
		rubriek: 'regering',
		sort: 'bewindspersonen',
		label: 'Bewindspersonen',
		vorm: 'bewindspersoon',
		lijst: 'ministers',
		bevat: true,
		laag: 'Bewindspersoon'
	}
];

const hex = (name: string) =>
	new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(
		readFileSync(join(process.cwd(), 'src/lib/styles/tokens.css'), 'utf8')
	)?.[1];

describe('the five soorten are the five rubrieken', () => {
	it('names them and puts them in the order of the Topbalk', () => {
		expect(SOURCES.map((s) => s.id)).toEqual([
			'wetten',
			'rechtspraak',
			'kamerstukken',
			'parlement',
			'regering'
		]);
		expect(SOURCES.map((s) => s.label)).toEqual(Object.values(RUBRIEK_LABEL));
		expect(Object.values(RUBRIEK_LABEL)).toEqual([
			'Wetten',
			'Rechtspraak',
			'Kamerstukken',
			'Parlement',
			'Regering'
		]);
	});

	it('gives each its colour in tokens.css, and leaves no --soort- token behind', () => {
		expect(hex('rubriek-wetten')).toBe('#00487c');
		expect(hex('rubriek-rechtspraak')).toBe('#438365');
		expect(hex('rubriek-kamerstukken')).toBe('#cd7127');
		expect(hex('rubriek-parlement')).toBe('#ab618e');
		expect(hex('rubriek-regering')).toBe('#523c0b');
		// The steps of the instanties stay.
		for (const trap of [1, 2, 3, 4]) expect(hex(`rechtspraak-${trap}`)).toBeDefined();
		const left = BRONNEN.filter(({ text }) =>
			/--soort-|soort(Wet|Parlement|Personen|Rechtspraak)/.test(text)
		);
		expect(left.map((b) => b.path)).toEqual([]);
	});
});

describe.each(BRONNEN_TABEL)('a $naam', (b) => {
	const { collection, key, props, relation } = b;

	it('is in one rubriek and one soort, by the one rule', () => {
		expect(rubriekOf(collection, key, props, relation)).toBe(b.rubriek);
		expect(filterGroupOf(collection, key, props, relation)).toBe(b.sort);
		expect(sortLabel(b.sort)).toBe(b.label);
	});

	it('is drawn in the colour of its rubriek', () => {
		expect(kindColour(collection, null, props)).toBe(rubriekColour(b.rubriek));
		expect(kindColour(collection, null, props)).toBe(`var(--rubriek-${b.rubriek})`);
	});

	it('has the shape of its soort', () => {
		expect(vormVanBron(collection, props, key)).toBe(b.vorm);
		expect(VORMEN[b.vorm]).toBeDefined();
		// A wetsvoorstel is a stuk with an open box: the soort's shape, varied.
		const variant = b.naam === 'wetsvoorstel';
		if (!variant) expect(SORT_SHAPE[b.sort]).toBe(b.vorm);
	});

	it('is in Tonen and the filter under the name of its soort', () => {
		const sort = filterGroupOf(collection, key, props, relation);
		expect(FILTER_GROUP_LABEL[sort]).toBe(b.label);
		expect(FILTER_GROUPS).toContain(sort);
	});

	it('is in Verbonden in a group of the same name', () => {
		const kind = kindOfBron(collection, key, props);
		expect(kind, 'a kind of Verbonden').not.toBeNull();
		// A dossier, a kabinet and the rest are named as the soort; on its own page a commissie's leden
		// stand as Leden, which is the one group of a person that is not a soort.
		expect(SOORT_LABEL[kind!].label).toBe(b.label);
		expect(kindLabelOn(kind!, 'dossiers')).toBe(b.label);
	});

	it('is in Bladeren under the rubriek it is in, as the soort is named', () => {
		const source = sourceOfCollection(collection, props);
		expect(source.id).toBe(b.rubriek);
		expect(source.label).toBe(RUBRIEK_LABEL[b.rubriek]);
		if (b.lijst === null) {
			// The data has no list of it: no tab either.
			expect(SOURCES.flatMap((s) => s.lists)).not.toContain(collection);
			return;
		}
		expect(source.lists).toContain(b.lijst);
		const tab = INDEX_CATEGORIES.find((c) => c.key === b.lijst)!;
		expect(tab.group).toBe(RUBRIEK_LABEL[b.rubriek]);
		// A list of instruments holds the wetten and the regelingen, the EU-handelingen too.
		if (b.sort !== 'internationaal') expect(tab.label).toBe(b.label);
	});

	it('is in the Topbalk and the Tabbalk under its rubriek', () => {
		const source = SOURCES.find((s) => s.id === b.rubriek)!;
		if (b.bevat) expect(source.holds.toLowerCase()).toContain(b.label.toLowerCase());
	});

	it('is searched in a group of the same name, where it is searched', () => {
		// A group of instruments holds the EU-handelingen too.
		if (!(SEARCH_KINDS as readonly string[]).includes(collection) || b.sort === 'internationaal')
			return;
		expect(groupLabel(collection).toLowerCase()).toContain(
			collection === 'members' ? b.label.toLowerCase() : sortLabel(b.sort).toLowerCase()
		);
		if (collection !== 'members') expect(groupLabel(collection)).toBe(bronPlural(collection));
	});

	it('stands in its keten in a layer named as its soort, where it has one', async () => {
		if (!b.laag) return;
		expect(await layerOf(b)).toBe(b.laag);
		// The singular of the soort, but for the rang a regeling or a uitspraak is drawn in.
		if (b.naam !== 'uitspraak') expect(b.laag.toLowerCase()).toBe(sortOne(b.sort).toLowerCase());
		expect(kindColour(collection, null, props)).toBe(rubriekColour(b.rubriek));
	});
});

const lawOf = (id: string) => ({
	id,
	key: id.split('/')[1],
	bwb_id: id.split('/')[1].toUpperCase(),
	celex: null,
	title: id,
	citation_title: id,
	short_title: null,
	abbreviation: null,
	display_name: id,
	signed_on: null,
	official_url: null,
	article_count: null,
	inbound_citation_count: 0,
	judgment_count: null,
	outbound_citation_count: null,
	path: null
});

/** A law with an AMvB under its article 16: the layers Wet, Artikel and AMvB. */
const KETEN = chain(
	{ id: 'instruments/bwbr0005289', name: 'Burgerlijk Wetboek' },
	{
		bwb_id: 'BWBR0005289',
		total: 1,
		items: [
			{
				instrument: lawOf('instruments/a'),
				kind: 'amvb',
				date_in_force: '2006-03-01',
				basis_kind: 'delegates',
				articles: [
					{
						leden: [],
						onderdelen: [],
						aanhef: false,
						id: 'articles/bwbr0005289_16',
						key: 'bwbr0005289_16',
						article_number: '16',
						display_name: 'Artikel 16',
						text: '16',
						basis_kind: 'delegates',
						referring: []
					}
				],
				also_based_on: [],
				sub_delegated: []
			}
		]
	} as never,
	null
);

/** The label of the layer a bron stands in, from the keten or the lineage the code builds. */
async function layerOf(b: Bron): Promise<string | undefined> {
	if (b.collection === 'instruments' || b.collection === 'articles')
		return KETEN.layers.find((l) => l.id === (b.collection === 'articles' ? 'article' : 'law'))
			?.label;
	const id = `${b.collection}/${b.key}`;
	const start = {
		node: {
			id,
			key: b.key,
			collection: b.collection,
			type: b.collection,
			display_name: b.key,
			labels: [],
			props: b.props ?? {}
		},
		neighbors: { total: 0, buckets: [] }
	} as never;
	const layers = await lineage(start, ['APPEAL_OF', 'MEMBER_OF', 'SERVED_IN'], async () => null);
	return layers.find((l) => l.nodes.some((n) => n.id === id))?.label;
}

describe('the keten names its layers as the soorten', () => {
	it('draws the regulations under a law in layers of their rang, in the colour of Wetten', () => {
		const rang = KETEN.layers.filter((l) => l.id === 'amvb').map((l) => l.label);
		expect(rang).toEqual(['AMvB']);
		expect(kindColour('instruments')).toBe(rubriekColour('wetten'));
	});

	const member = (items: [string, string][]) =>
		({
			node: { id: 'members/m', key: 'm', collection: 'members', type: 'member', props: {} },
			neighbors: {
				total: items.length,
				buckets: items.map(([collection, key]) => ({
					relation: collection === 'cabinets' ? 'SERVED_IN' : 'MEMBER_OF',
					direction: 'outbound',
					collection,
					type: collection,
					total: 1,
					next_offset: null,
					items: [
						{ id: `${collection}/${key}`, key, collection, type: collection, props: {}, labels: [] }
					]
				}))
			}
		}) as never;

	it('stands a Kamerlid on top, its fractie, kabinet and commissie under it', async () => {
		const layers = await lineage(
			member([
				['factions', 'd66'],
				['cabinets', 'rutte_iv'],
				['committees', 'j_v']
			]),
			['MEMBER_OF', 'SERVED_IN'],
			async () => null
		);
		expect(layers.map((l) => l.label)).toEqual(['Kamerlid', 'Fractie', 'Kabinet', 'Commissie']);
	});

	it('names a bewindspersoon as one, not a Kamerlid', async () => {
		const start = member([]) as unknown as { node: { props: Record<string, unknown> } };
		start.node.props = { government_functions: POST };
		const layers = await lineage(start as never, ['SERVED_IN'], async () => null);
		expect(layers.map((l) => l.label)).toEqual(['Bewindspersoon']);
	});
});

describe('the omhulling of each soort', () => {
	it('is told apart by its line, and coloured by its rubriek', async () => {
		const { hullColorFor, hullDashFor, FALLBACK } =
			await import('$lib/components/graph/nodeSprites');
		const hulls = [
			['instrument', 'wetten', undefined],
			['dossier', 'kamerstukken', '6 4'],
			['faction', 'parlement', '1.5 3'],
			['committee', 'parlement', '8 3 1.5 3'],
			['cabinet', 'regering', '8 3 1.5 3 1.5 3']
		] as const;
		for (const [kind, rubriek, dash] of hulls) {
			expect(hullDashFor(kind), kind).toBe(dash);
			expect(hullColorFor(kind), kind).toBe(
				FALLBACK[`rubriek${rubriek[0].toUpperCase()}${rubriek.slice(1)}` as keyof typeof FALLBACK]
			);
		}
		// Five hulls, five lines: none repeats one.
		expect(new Set(hulls.map(([kind]) => hullDashFor(kind))).size).toBe(hulls.length);
	});
});

describe('the order of the rubrieken', () => {
	const rubrieken = Object.keys(RUBRIEK_LABEL);
	const rank = (sort: Sort) => rubrieken.indexOf(sortRubriek(sort));
	const sortRubriek = rubriekOfSort;
	const inOrder = (sorts: readonly Sort[]) =>
		sorts.every((s, i) => i === 0 || rank(sorts[i - 1]) <= rank(s));

	it('is that of the Topbalk in the filter, Tonen and Verbonden', () => {
		expect(inOrder(FILTER_GROUPS.filter((s) => BRONNEN_TABEL.some((b) => b.sort === s)))).toBe(
			true
		);
		expect(FILTER_GROUPS[0]).toBe('wetten');
		expect(FILTER_GROUPS.at(-1)).toBe('bewindspersonen');
	});

	it('is that of the Topbalk in Bladeren, and in the search', () => {
		expect(INDEX_CATEGORIES.map((c) => c.group)).toEqual(
			SOURCES.flatMap((s) => s.lists.map(() => s.label))
		);
		const searched = SEARCH_KINDS.map((c) => rubriekOf(c, '', null));
		expect(searched.map((r) => rubrieken.indexOf(r))).toEqual(
			[...searched.map((r) => rubrieken.indexOf(r))].sort((a, b) => a - b)
		);
	});

	it('puts the rubriek of the bron itself first in Verbonden, the rest in order', () => {
		expect(sortsFrom('wetten')[0]).toBe('wetten');
		expect(rubriekOf('instruments', '')).toBe('wetten');
		const own = sortsFrom('parlement');
		expect(own.slice(0, 3)).toEqual(['kamerleden', 'fracties', 'commissies']);
		expect(inOrder(own.slice(3))).toBe(true);
		expect(own.slice(3, 4)).toEqual(['wetten']);

		const groupOf = (collection: Collection, key: string, props: Record<string, unknown> = {}) =>
			({
				id: `${collection}-${key}`,
				label: collection,
				rows: [
					{
						ref: { collection, key },
						title: key,
						context: null,
						filterGroup: filterGroupOf(collection, key, props),
						props
					} as Row
				],
				total: 1,
				capped: false
			}) as Group;
		const groups = [
			groupOf('committees', 'c'),
			groupOf('judgments', 'j'),
			groupOf('cabinets', 'k'),
			groupOf('members', 'm'),
			groupOf('documents', 'd'),
			groupOf('dossiers', 'x'),
			groupOf('factions', 'f'),
			groupOf('instruments', 'w'),
			groupOf('decisions', 's')
		];
		const per = (selection: Collection) => kindsOf(groups, selection, null).map((k) => k.label);
		// Around an article: Wetten, then Rechtspraak, Kamerstukken, Parlement, Regering.
		expect(per('articles')).toEqual([
			'Wetten',
			'Uitspraken',
			'Dossiers',
			'Stukken',
			'Stemmingen',
			'Kamerleden',
			'Fracties',
			'Commissies',
			'Kabinetten'
		]);
		// Around a dossier its own Kamerstukken stand first.
		expect(per('dossiers').slice(0, 3)).toEqual(['Dossiers', 'Stukken', 'Stemmingen']);
		// Around a Kamerlid, Parlement.
		expect(per('members').slice(0, 3)).toEqual(['Kamerleden', 'Fracties', 'Commissies']);
		// Around a kabinet, Regering.
		expect(per('cabinets')[0]).toBe('Kabinetten');
	});

	it('splits the persons of a bron by their role: Kamerleden in Parlement, bewindspersonen in Regering', () => {
		const persons = (props: Record<string, unknown>, key: string): Row =>
			({
				ref: { collection: 'members', key },
				title: key,
				context: null,
				filterGroup: filterGroupOf('members', key, props),
				props
			}) as Row;
		const group = {
			id: 'persons',
			label: 'p',
			rows: [persons({ party: 'VVD' }, 'a'), persons({ government_functions: POST }, 'b')],
			total: 2,
			capped: false
		} as Group;
		expect(kindsOf([group], 'dossiers', null).map((k) => [k.label, k.count])).toEqual([
			['Kamerleden', 1],
			['Bewindspersonen', 1]
		]);
	});
});

describe('the clusters', () => {
	const around = (n: number) => {
		const nodes = [
			{ id: 'judgments/focus', collection: 'judgments' as const },
			...Array.from({ length: n }, (_, i) => ({
				id: `judgments/j${i}`,
				collection: 'judgments' as const
			}))
		];
		const edges = nodes
			.slice(1)
			.map((m) => ({ source: m.id, target: 'judgments/focus', relation: 'REFERS_TO' }));
		return clustersOf(nodes, edges, 'judgments/focus', new Set(), new Set());
	};

	it('begin above 40, not at 40', () => {
		expect(CLUSTER_MAX_LOOSE).toBe(40);
		expect(around(40)).toHaveLength(0);
		expect(around(41)).toHaveLength(1);
	});

	it('say "N van M" where the API holds more, and the soort where it does not', () => {
		const [cluster] = around(41);
		expect(clusterHeading(cluster, 63600)).toBe('41 van 63.600 uitspraken');
		expect(clusterHeading(cluster, 41)).toBe('41 uitspraken');
		const row = (drawn: number, total: number | null): KindRow => ({
			id: 'x',
			label: 'Uitspraken',
			drawn,
			total,
			filterGroups: ['uitspraken'],
			collection: 'judgments',
			load: null
		});
		expect(kindRowCount(row(9, 29), true)).toBe('9 van 29');
		expect(kindRowCount(row(29, null), true)).toBe('29');
	});
});
