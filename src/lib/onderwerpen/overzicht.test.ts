import { describe, expect, it } from 'vitest';
import {
	csvTabel,
	KOLOM_RICHTING,
	kolomStem,
	filter,
	lijstQuery,
	perJaar,
	perSoort,
	totaal,
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

describe('overzicht', () => {
	it('telt per soort, met de stem van een fractie', () => {
		expect(perSoort(lijst, stemmen)[0]).toEqual([
			'Motie',
			{ totaal: 2, aangenomen: 1, verworpen: 1, overig: 0, voor: 1, tegen: 1 }
		]);
		expect(perSoort(lijst, stemmen).map(([k]) => k)).toContain('Overig');
		expect(totaal(lijst, stemmen).totaal).toBe(4);
	});

	it('telt per jaar, ook een jaar zonder besluiten ertussen', () => {
		expect(perJaar(lijst, stemmen).map(([j, t]) => [j, t.totaal])).toEqual([
			['2026', 2],
			['2025', 0],
			['2024', 2]
		]);
	});

	it('een getal en zijn lijst zijn even lang', () => {
		const [, motie] = perSoort(lijst, stemmen)[0];
		expect(filter(lijst, { soort: 'Motie', uitkomst: 'verworpen' }, stemmen)).toHaveLength(
			motie.verworpen
		);
		expect(filter(lijst, { stem: 'voor' }, stemmen).map((d) => d.key)).toEqual(['a']);
		expect(filter(lijst, { jaar: '2024' }, stemmen)).toHaveLength(2);
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
