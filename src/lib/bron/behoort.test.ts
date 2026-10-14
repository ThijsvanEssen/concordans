import { describe, expect, it } from 'vitest';
import { behoort, conclusieVan, dossierNummer, heeftIets, metEersteKamer } from './behoort';

type Item = {
	key: string;
	collection: string;
	display_name: string;
	props?: Record<string, unknown>;
};
const light = (
	buckets: {
		relation: string;
		direction: string;
		collection: string;
		total: number;
		items?: Item[];
	}[]
) =>
	({
		node: { labels: [] },
		neighbors: {
			total: 0,
			buckets: buckets.map((b) => ({
				...b,
				items: (b.items ?? []).map((i) => ({ ...i, relation: b.relation, direction: b.direction }))
			}))
		}
	}) as never;

describe('behoort', () => {
	it('keeps a stuk’s bijlagen out of the band (they are in its status line)', () => {
		const b = behoort(
			'documents',
			{ kind: 'Memorie van toelichting' },
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'dossiers',
					total: 1,
					items: [
						{
							key: '34372',
							collection: 'dossiers',
							display_name: 'Kamerstukdossier 34372: computercriminaliteit III',
							props: { number: '34372' }
						}
					]
				},
				{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'documents', total: 15 }
			])
		);
		expect(b.regels.map((r) => r.label)).toEqual(['Dossier']);
		expect(b.onder).toEqual([]);
	});

	it('puts an article under its law (at the article) and the law’s division, the law itself not twice', () => {
		const b = behoort(
			'articles',
			{
				instrument_citation_title: 'Algemene wet bestuursrecht',
				article_number: '3:4',
				breadcrumb: [
					{ type: 'hoofdstuk', label: 'Hoofdstuk 3', title: 'Algemene bepalingen over besluiten' },
					{ type: 'afdeling', label: 'Afdeling 3.2', title: 'Zorgvuldigheid en belangenafweging' }
				]
			},
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'instruments',
					total: 1,
					items: [
						{
							key: 'bwbr0005537',
							collection: 'instruments',
							display_name: 'Algemene wet bestuursrecht'
						}
					]
				}
			])
		);
		expect(b.regels.map((r) => r.label)).toEqual(['Wet']);
		const wet = b.regels[0].lagen;
		expect(wet.map((l) => [l.soort, l.naam])).toEqual([
			['Wet', 'Algemene wet bestuursrecht'],
			['hoofdstuk', 'Hoofdstuk 3 Algemene bepalingen over besluiten'],
			['afdeling', 'Afdeling 3.2 Zorgvuldigheid en belangenafweging']
		]);
		expect(wet.map((l) => l.at)).toEqual([
			'artikel-3:4',
			'deel-hoofdstuk-3',
			'deel-hoofdstuk-3-afdeling-3.2'
		]);
		expect(wet[2].ref).toEqual({ collection: 'instruments', key: 'bwbr0005537' });
	});

	it('names a book of the BW in the band as lawyers do, not BW7A (#68)', () => {
		const b = behoort(
			'articles',
			{ instrument_citation_title: 'Burgerlijk Wetboek Boek 7A', article_number: '1576' },
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'instruments',
					total: 1,
					items: [
						{
							key: 'bwbr0006000',
							collection: 'instruments',
							display_name: 'Burgerlijk Wetboek Boek 7A',
							props: { bwb_id: 'BWBR0006000', abbreviation: 'BW7A' }
						}
					]
				}
			])
		);
		expect(b.regels[0].lagen[0].kort).toBe('Boek 7A BW');
	});

	it('gives a judgment its procesgang as kern, more appeals as a group', () => {
		const b = behoort(
			'judgments',
			{},
			light([
				{
					relation: 'APPEAL_OF',
					direction: 'outbound',
					collection: 'judgments',
					total: 1,
					items: [
						{
							key: 'ecli_nl_ghdha_2018_2591',
							collection: 'judgments',
							display_name: 'Gerechtshof Den Haag, 9 oktober 2018 (Urgenda)'
						}
					]
				},
				{
					relation: 'APPEAL_OF',
					direction: 'inbound',
					collection: 'judgments',
					total: 2,
					items: [
						{
							key: 'ecli_nl_hr_2020_1',
							collection: 'judgments',
							display_name: 'Hoge Raad, 3 maart 2020'
						}
					]
				},
				{
					relation: 'ADVISES_ON',
					direction: 'inbound',
					collection: 'judgments',
					total: 1,
					items: [{ key: 'ecli_nl_phr_2019_887', collection: 'judgments', display_name: 'PHR' }]
				}
			])
		);
		expect(b.regels.map((r) => r.label)).toEqual(['Procesgang']);
		expect(b.regels[0].lagen.map((l) => [l.soort, !!l.huidig])).toEqual([
			['Eerdere aanleg', false],
			['Deze uitspraak', true],
			['Hoger beroep of cassatie', false]
		]);
		expect(b.regels[0].laad).toBeTypeOf('function');
		expect(b.regels[0].lagen.map((l) => l.kort)).toEqual(['Hof Den Haag 2018', 'deze', 'HR 2020']);
		expect(b.onder.map((g) => [g.label, g.aantal])).toEqual([['Hoger beroep of cassatie', 2]]);
		const conclusie = behoort(
			'judgments',
			{},
			light([
				{
					relation: 'ADVISES_ON',
					direction: 'outbound',
					collection: 'judgments',
					total: 1,
					items: [{ key: 'ecli_nl_hr_2019_2006', collection: 'judgments', display_name: 'HR' }]
				}
			])
		);
		expect(conclusie.regels.map((r) => r.label)).toEqual(['Conclusie bij']);
	});

	it('gives the conclusie of a judgment for its status line, without the word Conclusie', () => {
		const g = light([
			{
				relation: 'ADVISES_ON',
				direction: 'inbound',
				collection: 'judgments',
				total: 1,
				items: [
					{
						key: 'ecli_nl_phr_2019_887',
						collection: 'judgments',
						display_name: 'Conclusie P-G Langemeijer en Wissink, 13 september 2019'
					}
				]
			}
		]);
		const c = conclusieVan(g);
		expect(c?.naam).toBe('P-G Langemeijer en Wissink, 13 september 2019');
		expect(c?.ref?.key).toBe('ecli_nl_phr_2019_887');
		expect(conclusieVan(light([]))).toBeNull();
		expect(conclusieVan(null)).toBeNull();
	});

	it('puts a stuk in its dossier, a lid in its one fractie, and leaves out what is missing', () => {
		const stuk = behoort(
			'documents',
			{ kind: 'Motie' },
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'dossiers',
					total: 1,
					items: [
						{
							key: '36496',
							collection: 'dossiers',
							display_name:
								'Kamerstukdossier 36496: Wijziging van de Wet goed verhuurderschap en enige andere wetten (Wet betaalbare huur)',
							props: { label: '36496', short_title: 'Wet betaalbare huur' }
						}
					]
				}
			])
		);
		expect(stuk.regels.map((r) => r.label)).toEqual(['Ingediend bij']);
		expect(stuk.regels[0].lagen[0].naam).toBe('Kamerstuk 36496 Wet betaalbare huur');
		expect(stuk.regels[0].lagen[0].ref).toEqual({
			collection: 'dossiers',
			key: '36496',
			number: '36496'
		});
		expect(stuk.onder).toEqual([]);
		const lid = behoort(
			'members',
			{},
			light([
				{
					relation: 'MEMBER_OF',
					direction: 'outbound',
					collection: 'factions',
					total: 1,
					items: [{ key: 'vvd', collection: 'factions', display_name: 'VVD' }]
				},
				{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'committees', total: 4 }
			])
		);
		expect(lid.regels.map((r) => r.label)).toEqual(['Fractie']);
		// Commissies are context: in Verbonden, not in the band (Thijs, 9 Oct).
		expect(lid.onder).toEqual([]);
		expect(heeftIets(behoort('cabinets', {}, light([])))).toBe(false);
	});

	it('puts a paper of a bill with its wetsvoorstel, and the rest of its zaak in Verbonden only', () => {
		const metZaak = (kind: string) =>
			behoort('documents', { kind }, {
				...(light([
					{ relation: 'PART_OF', direction: 'outbound', collection: 'cases', total: 1 }
				]) as object),
				node: { key: 'mvt' }
			} as never);
		const mvt = metZaak('Memorie van toelichting (initiatiefvoorstel)');
		expect(mvt.regels.map((r) => [r.id, r.label, r.lagen.length, !!r.laad])).toEqual([
			['wetsvoorstel', 'Bij wetsvoorstel', 0, true]
		]);
		// The rest of the zaak is context: in Verbonden, not in the band (Thijs, 9 Oct).
		expect(mvt.onder).toEqual([]);
		// A geleidende brief offers the substance of its zaak: kern, side by side.
		expect(metZaak('Geleidende brief').regels.map((r) => [r.id, r.label, r.los, !!r.laad])).toEqual(
			[['biedt-aan', 'Biedt aan', true, true]]
		);
		// A motie is no paper of the bill: no line.
		expect(metZaak('Motie').regels).toEqual([]);
		expect(metZaak('Motie').onder).toEqual([]);
		// Without a zaak, nothing: no line waits, no empty group.
		const zonder = behoort('documents', { kind: 'Nota van wijziging' }, {
			...(light([]) as object),
			node: { key: 'x' }
		} as never);
		expect([zonder.regels, zonder.onder]).toEqual([[], []]);
	});
});

describe('the lines of every kind of bron', () => {
	const one = (relation: string, collection: string, item: Partial<Item> = {}, meta = {}) => ({
		relation,
		direction: 'outbound',
		collection,
		total: 1,
		items: [{ key: 'k', collection, display_name: 'Naam', ...item, meta } as Item]
	});
	const lines = (b: ReturnType<typeof behoort>) =>
		b.regels.map((r) => [r.id, r.label, r.lagen.map((l) => l.soort), !!r.laad, !!r.los]);

	it('gives a stuk its dossier with its bill, its debat, its brief, in that order', () => {
		const stuk = (kind: string, reason: string) =>
			behoort('documents', { kind }, {
				...(light([
					one('PART_OF', 'dossiers', { props: { number: '34372' } }),
					one('MADE_IN', 'activities', {}, { reason }),
					one('ACCOMPANIES', 'documents'),
					{ relation: 'PART_OF', direction: 'outbound', collection: 'cases', total: 1 }
				]) as object),
				node: { key: 'stuk' }
			} as never);
		expect(lines(stuk('Memorie van toelichting', 'verslag'))).toEqual([
			['dossier', 'Dossier', ['Dossier'], true, false],
			['debat', 'Verslag van', ['Activiteit'], false, false],
			['brief', 'Bijlage bij', ['Brief'], false, false]
		]);
		expect(lines(stuk('Motie', 'ingediend'))).toEqual([
			['dossier', 'Ingediend bij', ['Dossier'], false, false],
			['debat', 'Ingediend in', ['Activiteit'], false, false],
			['brief', 'Bijlage bij', ['Brief'], false, false]
		]);
		expect(lines(stuk('Geleidende brief', 'verslag')).map((l) => l[0])).toEqual([
			'dossier',
			'debat',
			'brief',
			'biedt-aan'
		]);
	});

	it('gives an activiteit its commissie, its dossiers and where it moved from', () => {
		const b = behoort('activities', {}, {
			...(light([one('LED_BY', 'committees'), one('ABOUT', 'dossiers')]) as object),
			node: { key: 'a1' }
		} as never);
		expect(lines(b)).toEqual([
			['commissie', 'Commissie', ['Commissie'], false, false],
			['dossier', 'Over', ['Dossier'], true, true],
			['verplaatst', 'Verplaatst van', [], true, true]
		]);
	});

	it('gives the other kinds one line from one bucket, or from their Kamer', () => {
		expect(lines(behoort('cases', {}, light([one('PART_OF', 'dossiers')])))).toEqual([
			['dossier', 'Dossier', ['Dossier'], false, false]
		]);
		for (const c of ['decisions', 'commitments'] as const)
			expect(lines(behoort(c, {}, light([one('ABOUT', 'dossiers')])))).toEqual([
				['dossier', 'Over', ['Dossier'], false, false]
			]);
		expect(lines(behoort('instruments', {}, light([one('LEGISLATED_IN', 'dossiers')])))).toEqual([
			['wetsvoorstel', 'Wetsvoorstel', ['Dossier'], false, false]
		]);
		for (const c of ['factions', 'committees'] as const)
			expect(lines(behoort(c, { chamber: 'EK' }, light([])))).toEqual([
				['kamer', 'Kamer', ['Kamer'], false, false]
			]);
		expect(lines(behoort('annexes', {}, light([one('PART_OF', 'instruments')])))).toEqual([
			['wet', 'Wet', ['Wet'], false, false]
		]);
		expect(behoort('cabinets', {}, light([]))).toEqual({ regels: [], onder: [] });
		expect(behoort('concepts' as never, {}, light([]))).toEqual({ regels: [], onder: [] });
	});

	it('gives a lid its fracties with their periods side by side', () => {
		const b = behoort(
			'members',
			{
				faction_memberships: [
					{ faction_key: 'd66', abbreviation: 'D66', start_date: '2023-12-06', end_date: null }
				]
			},
			light([])
		);
		expect(lines(b)).toEqual([['fractie', 'Fractie', ['Fractie'], false, true]]);
	});
});

describe('kern of context', () => {
	it('leaves the kern out of Verbonden, and only the kern', async () => {
		const { GROUPS } = await import('$lib/verbonden/groups');
		const { isKernGroep } = await import('./behoort');
		const kern = (c: keyof typeof GROUPS) =>
			(GROUPS[c] ?? []).filter((g) => isKernGroep(c, g)).map((g) => g.id);
		expect(kern('judgments')).toEqual([
			'conclusion',
			'advised',
			'earlier-instance',
			'later-instance'
		]);
		expect(kern('articles')).toEqual(['law']);
		expect(kern('documents')).toEqual([
			'dossier',
			'replaces',
			'replaced-by',
			'attachment-of',
			'record-of',
			'submitted-in'
		]);
		expect(kern('members')).toEqual(['factions']);
		expect(kern('instruments')).toEqual([]);
	});

	it('leaves the same groups out of Verbonden for every kind of bron', async () => {
		const { GROUPS } = await import('$lib/verbonden/groups');
		const { isKernGroep } = await import('./behoort');
		const kern = Object.fromEntries(
			Object.entries(GROUPS).map(([c, groups]) => [
				c,
				(groups ?? []).filter((g) => isKernGroep(c as never, g)).map((g) => g.id)
			])
		);
		expect(kern).toMatchInlineSnapshot(`
			{
			  "activities": [
			    "dossier",
			    "committee",
			  ],
			  "articles": [
			    "law",
			  ],
			  "cabinets": [],
			  "cases": [
			    "dossier",
			  ],
			  "commitments": [
			    "dossier",
			    "activity",
			  ],
			  "committees": [],
			  "decisions": [
			    "dossier",
			  ],
			  "documents": [
			    "dossier",
			    "replaces",
			    "replaced-by",
			    "attachment-of",
			    "record-of",
			    "submitted-in",
			  ],
			  "dossiers": [],
			  "factions": [],
			  "instruments": [],
			  "judgments": [
			    "conclusion",
			    "advised",
			    "earlier-instance",
			    "later-instance",
			  ],
			  "members": [
			    "factions",
			  ],
			}
		`);
	});

	it('puts an eerdere aanleg the data lacks in the procesgang, as text', () => {
		const b = behoort(
			'judgments',
			{
				unresolved_appeal_targets: [
					{ court: 'rechtbank Gelderland', date: '2025-07-09', case_number: '24/6811' }
				]
			},
			light([])
		);
		expect(b.regels[0].label).toBe('Procesgang');
		expect(b.regels[0].lagen[0]).toMatchObject({
			naam: 'Rechtbank Gelderland, 9 juli 2025, 24/6811',
			kort: 'Rb. Gelderland 2025'
		});
		expect(b.regels[0].lagen[0].ref).toBeUndefined();
	});
});

describe('a translation and a dossier', () => {
	it('names the original of a translation, its procesgang to follow', () => {
		const b = behoort('judgments', { translation_of: 'ECLI:NL:HR:2019:2006' }, light([]));
		expect(b.regels.map((r) => [r.id, r.label, r.lagen.length, !!r.laad])).toEqual([
			['vertaling', 'Vertaling van', 1, true],
			['procesgang', 'Procesgang', 0, true]
		]);
		expect(b.regels[0].lagen[0].ref).toEqual({
			collection: 'judgments',
			key: 'ecli_nl_hr_2019_2006'
		});
	});

	it('reads the Kamer of a dossier from its label where props lack it', () => {
		const l = { node: { labels: ['TK'] }, neighbors: { total: 0, buckets: [] } } as never;
		const regels = behoort('dossiers', {}, l).regels;
		expect(regels.map((r) => [r.label, r.lagen[0]?.naam ?? null, !!r.laad])).toEqual([
			// What the bill amends and implements stands in the reader, under the title.
			['Behandeld in', 'Tweede Kamer', false]
		]);
	});
});

describe('the number of a dossier', () => {
	it('keeps its suffix, from the label or from number and suffix', () => {
		expect(dossierNummer({ number: '36600', suffix: 'VII', label: '36600-VII' })).toBe('36600-VII');
		expect(dossierNummer({ number: '36600', suffix: 'VII' })).toBe('36600-VII');
		expect(dossierNummer({ number: '36496' })).toBe('36496');
		expect(dossierNummer({})).toBeNull();
	});
});

describe('the Kamers that dealt with a dossier', () => {
	const tk = [{ soort: 'Kamer', naam: 'Tweede Kamer' }];
	it('adds the Eerste Kamer where the detail holds its papers or its outcome there', () => {
		expect(metEersteKamer(tk, { senate: { document_count: 14 } })).toEqual([
			{ soort: 'Kamer', naam: 'Tweede Kamer en Eerste Kamer' }
		]);
		expect(metEersteKamer(tk, { ek_outcome: { outcome: 'Aangenomen' } })[0].naam).toBe(
			'Tweede Kamer en Eerste Kamer'
		);
		expect(metEersteKamer(tk, { senate: { document_count: 0 }, ek_outcome: null })).toEqual(tk);
		expect(metEersteKamer([], { senate: { document_count: 3 } })[0].naam).toBe('Eerste Kamer');
	});
});
