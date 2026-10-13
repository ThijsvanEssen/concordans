// Guard: a law's regulations read alike under a kept law in a map (MapRegelingen) and in its
// group Gebaseerd op deze wet in Verbonden: one request, one row per regulation, the same
// name, kind, day and articles (equal pages, equal experience).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schema } from '$lib/api/types';

const answer: { current: Schema<'InstrumentDelegatedResponse'> | null } = { current: null };
const asked = vi.fn();
vi.mock('$lib/api/articles', async (original) => ({
	...(await original<typeof import('$lib/api/articles')>()),
	getLawDelegated: (bwb: string) => {
		asked(bwb);
		return Promise.resolve(answer.current);
	}
}));
const related = vi.fn();
vi.mock('$lib/api/client', async (original) => ({
	...(await original<typeof import('$lib/api/client')>()),
	api: {
		GET: (path: string) => {
			related(path);
			return Promise.resolve({ data: { items: [], total: 0 } });
		}
	},
	unwrap: async (p: Promise<{ data: unknown }>) => (await p).data
}));

const { onderWet, regelVanRij } = await import('./verbonden');
const { LOADERS, regelingRow, wetRegelingRow } = await import('$lib/verbonden/loaders');
const { hoeVan } = await import('$lib/verbonden/hoe');
const { metaParts } = await import('$lib/verbonden/rows');
const { grondslagArtikelen } = await import('$lib/text/delegaties');

const instrument = (key: string, title: string): Schema<'InstrumentSummaryDTO'> => ({
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
const artikel = (n: string, leden: string[] = []): Schema<'BasisArticleDTO'> => ({
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
	asked.mockClear();
	related.mockClear();
});

describe('Gebaseerd op deze wet', () => {
	it('names the articles a regulation rests on once each, with their leden', () => {
		expect(grondslagArtikelen(cbw.items![0].articles)).toBe('art. 16 lid 1 en 7, 21 lid 5, 24');
		// A BW article with its book.
		expect(grondslagArtikelen([artikel('719', ['2'])], 'BWBR0005290')).toBe('art. 7:719 lid 2');
		// Never its own number as a lid.
		expect(grondslagArtikelen([artikel('673e', ['673', '1', '4'])], 'BWBR0005290')).toBe(
			'art. 7:673e lid 1 en 4'
		);
		expect(grondslagArtikelen([])).toBeNull();
	});

	it('lists the same regulations in a map as in Verbonden', async () => {
		const [kaart, groep] = await Promise.all([onderWet('BWBR0052872'), verbonden()]);
		expect(asked).toHaveBeenCalledWith('BWBR0052872');
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
		expect(related).not.toHaveBeenCalled();
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
		const opArtikel = hoeVan(regelingRow({ ...cbw.items![0], leden: ['1', '7'] }), 'articles');
		expect([opArtikel?.werkwoord, opArtikel?.rest]).toEqual(['AMvB op grond van', 'lid 1 en 7']);
		const zonderLid = hoeVan(regelingRow({ ...cbw.items![0], leden: [] }), 'articles');
		expect([zonderLid?.werkwoord, zonderLid?.rest]).toEqual(['AMvB op grond van', 'dit artikel']);
	});

	it('lists the connected laws in a map where nothing is issued under the law', async () => {
		answer.current = { bwb_id: 'BWBR0001854', total: 0, items: [] };
		const kaart = await onderWet('BWBR0001854');
		expect(kaart.titel).toBe('Wetten die met deze wet verbonden zijn');
		expect(related).toHaveBeenCalledWith('/api/instruments/{bwb_id}/related-instruments');
		expect((await verbonden()).rows).toEqual([]);
	});
});
