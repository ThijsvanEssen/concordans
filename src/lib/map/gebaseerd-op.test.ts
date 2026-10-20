// Guard: a law's regulations read alike under a kept law in a map (MapRegelingen) and in its
// group Gebaseerd op deze wet in Verbonden: one request, one row per regulation, the same
// name, kind, day and articles (equal pages, equal experience).
import { beforeEach, describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { fakeApi } from '$lib/test/fakeApi';
import { onderWet, regelVanRij } from './verbonden';
import { LOADERS, basisRow, regelingRow, wetRegelingRow } from '$lib/verbonden/loaders';
import { hoeVan } from '$lib/verbonden/hoe';
import { metaParts } from '$lib/verbonden/rows';
import { grondslagArtikelen } from '$lib/text/delegaties';

const answer: { current: Schema<'InstrumentDelegatedResponse'> | null } = { current: null };
let fake: ReturnType<typeof fakeApi>;
/** The paths asked, in order. */
const paths = () => fake.requests.map((r) => r.path);

const instrument = (key: string, title: string): Schema<'InstrumentSummaryDTO'> => ({
	judgment_count: null,
	outbound_citation_count: null,
	celex: null,
	short_title: null,
	abbreviation: null,
	signed_on: null,
	official_url: null,
	id: `instruments/${key}`,
	key,
	bwb_id: key.toUpperCase(),
	title,
	citation_title: title,
	display_name: title,
	article_count: 1,
	inbound_citation_count: 0,
	path: null
});
const artikel = (n: string, leden: string[] = []): Schema<'ImplementedBasisArticleDTO'> => ({
	onderdelen: [],
	basis_kind: null,
	referring: [],
	id: `articles/bwbr0052872_${n}`,
	key: `bwbr0052872_${n}`,
	article_number: n,
	display_name: `Artikel ${n} Cyberbeveiligingswet`,
	text: n,
	leden,
	aanhef: false
});

// The Cyberbeveiligingswet: its AMvB on five articles, a ministerial regulation on one.
const cbw: Schema<'InstrumentDelegatedResponse'> = {
	bwb_id: 'BWBR0052872',
	total: 2,
	items: [
		{
			instrument: instrument('bwbr0052875', 'Cyberbeveiligingsbesluit'),
			kind: 'amvb',
			date_in_force: '2026-08-15',
			basis_kind: null,
			also_based_on: [],
			sub_delegated: [],
			articles: [
				artikel('16', ['1', '7']),
				artikel('16', ['1']),
				artikel('21', ['5']),
				artikel('24')
			]
		},
		{
			instrument: instrument('bwbr0052900', 'Cyberbeveiligingsregeling voor de zorg'),
			kind: 'ministeriele-regeling',
			date_in_force: '2026-08-15',
			basis_kind: null,
			also_based_on: [],
			sub_delegated: [],
			articles: [artikel('68', ['1'])]
		}
	]
};

const node = {
	id: 'instruments/bwbr0052872',
	key: 'bwbr0052872',
	props: { bwb_id: 'BWBR0052872' }
};
const verbonden = () =>
	LOADERS['instrument-delegated']({
		node,
		signal: new AbortController().signal
	} as unknown as Parameters<(typeof LOADERS)['instrument-delegated']>[0]);

beforeEach(() => {
	answer.current = cbw;
	fake = fakeApi({
		'/api/instruments/{bwb_id}/delegated': () => answer.current,
		'/api/instruments/{bwb_id}/related-instruments': { items: [], total: 0 }
	});
});

describe('the list "Gebaseerd op deze wet"', () => {
	it('names the articles a regulation rests on once each, with their leden', () => {
		expect(grondslagArtikelen(cbw.items![0].articles)).toBe('art. 16 lid 1 en 7, 21 lid 5, 24');
		// A BW article with its book.
		expect(grondslagArtikelen([artikel('719', ['2'])], 'BWBR0005290')).toBe('art. 7:719 lid 2');
		// The leden as the API gives them (0.79.55: never the article's own number).
		expect(grondslagArtikelen([artikel('673e', ['1', '4'])], 'BWBR0005290')).toBe(
			'art. 7:673e lid 1 en 4'
		);
		expect(grondslagArtikelen([])).toBeNull();
	});

	it('lists the same regulations in a map as in Verbonden', async () => {
		const [kaart, groep] = await Promise.all([onderWet('BWBR0052872'), verbonden()]);
		expect(fake.asked('/api/instruments/{bwb_id}/delegated')).toContainEqual({
			path: { bwb_id: 'BWBR0052872' }
		});
		expect(kaart.titel).toBe('Gebaseerd op deze wet');
		expect(groep.total).toBe(2);
		expect(kaart.regelingen.map((r) => [r.id, r.naam, r.soort, r.datum, r.artikelen])).toEqual(
			groep.rows.map((r) => [
				`${r.ref.collection}/${r.ref.key}`,
				r.title,
				r.context,
				r.date,
				regelVanRij(r, 'instruments')
			])
		);
		expect(kaart.regelingen[0]).toMatchObject({
			naam: 'Cyberbeveiligingsbesluit',
			soort: null,
			datum: '2026-08-15',
			artikelen: 'AMvB op grond van art. 16 lid 1 en 7, 21 lid 5, 24'
		});
		expect(paths()).toEqual(['/api/instruments/{bwb_id}/delegated']);
	});

	it('says in Verbonden what the regulation rests on, then its kind and day', () => {
		const row = wetRegelingRow(cbw.items![0]);
		const h = hoeVan(row, 'instruments');
		expect([h?.werkwoord, h?.rest]).toEqual([
			'AMvB op grond van',
			'art. 16 lid 1 en 7, 21 lid 5, 24'
		]);
		expect(metaParts(row, true).map((p) => p.text)).toEqual(['in werking 15 aug. 2026']);
		// On the article: the same verb, its leden.
		const opArtikel = hoeVan(
			regelingRow({ ...cbw.items![0], leden: ['1', '7'], articles: [] }),
			'articles'
		);
		expect([opArtikel?.werkwoord, opArtikel?.rest]).toEqual(['AMvB op grond van', 'lid 1 en 7']);
		const zonderLid = hoeVan(
			regelingRow({ ...cbw.items![0], leden: [], articles: [] }),
			'articles'
		);
		expect([zonderLid?.werkwoord, zonderLid?.rest]).toEqual(['AMvB op grond van', 'dit artikel']);
	});

	it('lists the connected laws in a map where nothing is issued under the law', async () => {
		answer.current = { bwb_id: 'BWBR0001854', total: 0, items: [] };
		const kaart = await onderWet('BWBR0001854');
		expect(kaart.titel).toBe('Wetten die met deze wet verbonden zijn');
		expect(paths()).toContain('/api/instruments/{bwb_id}/related-instruments');
		expect((await verbonden()).rows).toEqual([]);
	});
});

describe('the list "Gebaseerd op deze wet", under the AMvB and beside it', () => {
	const besluit = cbw.items![0];
	const verwijzend = (n: string) => ({
		id: `articles/bwbr0052875_${n}`,
		key: `bwbr0052875_${n}`,
		article_number: n,
		display_name: `Artikel ${n} Cyberbeveiligingsbesluit`,
		leden: [],
		onderdelen: [],
		aanhef: false
	});
	const met = {
		...besluit,
		articles: [
			{ ...artikel('16', ['1', '7']), referring: [verwijzend('3'), verwijzend('2')] },
			{ ...artikel('17', ['1']), referring: [verwijzend('2')] }
		],
		also_based_on: [
			{
				instrument: instrument('bwbr0026338', 'Drinkwaterwet'),
				kind: 'wet',
				basis_kind: null,
				articles: [artikel('54a')]
			},
			{
				instrument: instrument('bwbr0009950', 'Telecommunicatiewet'),
				kind: 'wet',
				basis_kind: null,
				articles: [artikel('11a.1')]
			}
		],
		sub_delegated: [
			{
				instrument: instrument('bwbr0052878', 'Cyberbeveiligingsregeling IenW'),
				kind: 'ministeriele-regeling',
				date_in_force: '2026-08-15',
				basis_kind: null,
				articles: [artikel('19'), artikel('23'), artikel('28')]
			}
		]
	};

	it('lists a regulation issued under the AMvB right under it, with its grondslag', async () => {
		answer.current = { ...cbw, items: [met, cbw.items![1]] };
		const groep = await verbonden();
		expect(groep.rows.map((r) => [r.title, r.onder ?? null])).toEqual([
			['Cyberbeveiligingsbesluit', null],
			['Cyberbeveiligingsregeling IenW', 'bwbr0052875'],
			['Cyberbeveiligingsregeling voor de zorg', null]
		]);
		expect(groep.total).toBe(3);
		const onder = hoeVan(groep.rows[1], 'instruments');
		expect([onder?.werkwoord, onder?.rest]).toEqual([
			'Ministeriële regeling op grond van',
			'art. 19, 23, 28 Cyberbeveiligingsbesluit'
		]);
	});

	it('says which articles work the grondslag out and what else it rests on', () => {
		const row = wetRegelingRow(met);
		const h = hoeVan(row, 'instruments');
		expect([h?.werkwoord, h?.rest]).toEqual([
			'AMvB op grond van',
			'art. 16 lid 1 en 7, 17 lid 1, uitgewerkt in art. 2 en 3'
		]);
		expect(metaParts(row, true).map((p) => p.text)).toEqual([
			'mede op grond van Drinkwaterwet en Telecommunicatiewet',
			'in werking 15 aug. 2026'
		]);
	});

	it('gives a regulation its own grondslag, by the law its preamble names', () => {
		const row = basisRow({
			instrument: instrument('bwbr0052872', 'Cyberbeveiligingswet'),
			kind: 'wet',
			basis_kind: 'delegates',
			articles: [{ ...artikel('16', ['1', '7']), referring: [verwijzend('2')] }]
		});
		const h = hoeVan(row, 'instruments');
		expect([h?.werkwoord, h?.rest]).toEqual([
			'Op grond van',
			'art. 16 lid 1 en 7, uitgewerkt in art. 2'
		]);
		expect(row).toMatchObject({ direction: 'outbound', context: 'Wet' });
	});

	it('asks no grondslag where the node counts none', async () => {
		const leeg = await LOADERS['instrument-basis']({
			node,
			totals: new Map([['BASED_ON/articles/outbound', 0]]),
			signal: new AbortController().signal
		} as unknown as Parameters<(typeof LOADERS)['instrument-basis']>[0]);
		expect(leeg.rows).toEqual([]);
	});
});
