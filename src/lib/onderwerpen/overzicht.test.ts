import { describe, expect, it } from 'vitest';
import {
	csvTabel,
	KOLOM_KANT,
	KOLOM_RICHTING,
	kantVan,
	kolomStem,
	filter,
	lijstQuery,
	richtingTabel,
	uitFacets,
	type Besluit,
	type Facets,
	type Stem
} from './overzicht';

const b = (
	key: string,
	date: string,
	kind: string | null,
	passed: boolean | null,
	subject = ''
): Besluit => ({
	id: `decisions/${key}`,
	key,
	path: null,
	date,
	kind,
	passed,
	subject,
	chamber: 'TK',
	decision_kind: passed === null ? 'Stemmen - uitstellen' : 'Stemmen - aangenomen',
	dossier_numbers: ['35334'],
	tally: { Voor: 80, Tegen: 70 }
});

const lijst = [
	b('a', '2026-07-02', 'Motie', true, 'Motie over stikstof'),
	b('b', '2026-06-01', 'Motie', false),
	b('c', '2024-03-01', 'Amendement', true),
	b('d', '2024-01-01', null, null)
];
const stemmen = new Map<string, Stem>([
	['a', 'voor'],
	['b', 'tegen']
]);

const coalitie = (cf: number, ca: number, of: number, oa: number) => ({
	cabinet: 'schoof',
	coalition_for: cf,
	coalition_against: ca,
	opposition_for: of,
	opposition_against: oa,
	pattern: 'together' as const,
	carried: false,
	decisive: false
});
/** The moties of `lijst` with a coalition vote: a the coalition for, b the coalition split. */
const moties: Besluit[] = [
	{ ...lijst[0], coalition: coalitie(88, 0, 10, 52) },
	{ ...lijst[1], coalition: coalitie(44, 44, 30, 32) }
];

describe('overzicht', () => {
	it('filtert op soort, uitkomst, jaar, de stem van een fractie en een kant', () => {
		expect(filter(lijst, { soort: 'Motie', uitkomst: 'verworpen' }, stemmen)).toHaveLength(1);
		expect(filter(lijst, { stem: 'voor' }, stemmen).map((d) => d.key)).toEqual(['a']);
		expect(filter(lijst, { jaar: '2024' }, stemmen)).toHaveLength(2);
		expect(filter(moties, { coalitie: 'voor' }, stemmen).map((d) => d.key)).toEqual(['a']);
		expect(filter(moties, { oppositie: 'tegen' }, stemmen).map((d) => d.key)).toEqual(['a', 'b']);
	});

	it('leest de kant van de coalitie en de oppositie uit de meeste zetels', () => {
		expect(kantVan(moties[0], 'coalitie')).toBe('voor');
		expect(kantVan(moties[0], 'oppositie')).toBe('tegen');
		expect(kantVan(moties[1], 'coalitie')).toBeUndefined();
		expect(kantVan(lijst[2], 'coalitie')).toBeUndefined();
	});
});

describe('de tabel van de export', () => {
	it('zet de stem van de fractie en de eigen richting in hun kolommen', () => {
		const motie = new Map([['a', { richting: 'positief' }]]);
		const t = csvTabel(lijst.slice(0, 2), '', 'VVD', stemmen, new Map(), motie);
		const stem = t.kop.indexOf(kolomStem('VVD'));
		const richting = t.kop.indexOf(KOLOM_RICHTING);
		expect(t.rijen.map((r) => r[stem])).toEqual(['voor', 'tegen']);
		expect(t.rijen.map((r) => r[richting])).toEqual(['positief', '']);
		expect(t.kop).not.toContain(KOLOM_KANT.coalitie);
	});

	it('zet de kant van de coalitie en de oppositie erbij waar de besluiten die hebben', () => {
		const t = csvTabel(moties, '', null, new Map(), new Map(), new Map());
		const c = t.kop.indexOf(KOLOM_KANT.coalitie);
		const o = t.kop.indexOf(KOLOM_KANT.oppositie);
		expect(t.rijen.map((r) => [r[c], r[o]])).toEqual([
			['voor', 'tegen'],
			['', 'tegen']
		]);
	});
});

describe('Richting telt de rijen van de export', () => {
	it('per richting, uitkomst, de stem van de fractie en de kant', () => {
		const motie = new Map([
			['a', { richting: 'positief' }],
			['b', { richting: 'positief' }]
		]);
		const t = csvTabel(moties, '', 'VVD', stemmen, new Map(), motie);
		const r = new Map(richtingTabel(t, 'VVD'));
		expect(r.get('positief')).toMatchObject({
			totaal: 2,
			aangenomen: 1,
			verworpen: 1,
			voor: 1,
			tegen: 1,
			coalitie: { voor: 1, tegen: 0 },
			oppositie: { voor: 0, tegen: 2 }
		});
		expect(r.get('negatief')?.totaal).toBe(0);
	});

	it('een motie zonder codering telt als niet gecodeerd', () => {
		const t = csvTabel(lijst.slice(0, 2), '', null, new Map(), new Map(), new Map());
		const r = new Map(richtingTabel(t, null));
		expect(r.get('geen')).toMatchObject({ totaal: 2, aangenomen: 1, verworpen: 1, voor: 0 });
		expect([...r.keys()]).toEqual(['positief', 'negatief', 'neutraal', 'geen']);
	});

	it('een getal en zijn lijst zijn even lang', () => {
		const motie = new Map([['a', { richting: 'positief' }]]);
		const t = csvTabel(moties, '', 'VVD', stemmen, new Map(), motie);
		const positief = new Map(richtingTabel(t, 'VVD')).get('positief')!;
		const lijstVan = (f: Parameters<typeof filter>[1]) =>
			filter(
				moties.filter((d) => motie.get(d.key)?.richting === 'positief'),
				f,
				stemmen
			);
		expect(lijstVan({ uitkomst: 'aangenomen' })).toHaveLength(positief.aangenomen);
		expect(lijstVan({ stem: 'voor' })).toHaveLength(positief.voor);
		expect(lijstVan({ coalitie: 'voor' })).toHaveLength(positief.coalitie.voor);
	});
});

describe('de API telt (0.79.30)', () => {
	const facets = {
		kind: [
			{ value: 'Motie', count: 61, passed: 45, rejected: 16 },
			{ value: 'Amendement', count: 1, passed: 1, rejected: 0 }
		],
		passed: [],
		days: [],
		years: [
			{ year: '2024', count: 8, passed: 4, rejected: 4 },
			{ year: '2026', count: 23, passed: 20, rejected: 3 }
		],
		party_votes: [
			{
				party: 'vvd',
				name: 'VVD',
				voor: 43,
				tegen: 19,
				none: 0,
				kind: [{ value: 'Motie', voor: 42, tegen: 19, none: 0 }],
				years: [{ year: '2026', voor: 15, tegen: 5, none: 0 }]
			}
		]
	} as unknown as Facets;

	it('zet de tellingen per soort en jaar om, met de stem van de fractie', () => {
		const g = uitFacets(facets, 'VVD');
		expect(g.alles).toMatchObject({
			totaal: 62,
			aangenomen: 46,
			verworpen: 16,
			voor: 43,
			tegen: 19
		});
		expect(g.soorten[0]).toEqual([
			'Motie',
			{ totaal: 61, aangenomen: 45, verworpen: 16, overig: 0, voor: 42, tegen: 19 }
		]);
		expect(g.jaren.map(([j, t]) => [j, t.totaal, t.voor])).toEqual([
			['2026', 23, 15],
			['2025', 0, 0],
			['2024', 8, 0]
		]);
		expect(uitFacets(facets, null).alles.voor).toBe(0);
	});

	it('vraagt de lijst achter een getal met precies zijn filters', () => {
		const basis = { q: ['AI', 'kunstmatige intelligentie'], from: '2025-06-01' };
		expect(lijstQuery(basis, { soort: 'Motie', uitkomst: 'verworpen' }, null)).toEqual({
			...basis,
			kind: 'Motie',
			passed: false
		});
		expect(lijstQuery(basis, { jaar: '2025', stem: 'tegen' }, 'VVD')).toEqual({
			...basis,
			from: '2025-06-01',
			to: '2025-12-31',
			party: 'VVD',
			vote: 'tegen'
		});
	});
});
