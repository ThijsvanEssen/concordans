import { describe, expect, it } from 'vitest';
import {
	csvTabel,
	KOLOM_STREKKING,
	kolomStem,
	lijstQuery,
	outcomeShape,
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
	display_name: null,
	external_id: null,
	dossiers: [],
	primary_case_kind: null,
	motion_kind: null,
	result: null,
	method: null,
	bill_decision: null,
	vote_kind: null,
	voters: {},
	dictum: null,
	motion: null,
	motion_kind: null,
	coalition: null,
	kind_group: null,
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
	b('b', '2026-06-01', 'Motie', false)
];
const stemmen = new Map<string, Stem>([
	['a', 'voor'],
	['b', 'tegen']
]);

describe('the table of the export', () => {
	it('puts the vote of the fractie and the own strekking in their columns', () => {
		const motie = new Map([['a', { strekking: 'bevorderend' }]]);
		const t = csvTabel(lijst, '', 'VVD', stemmen, new Map(), motie);
		const stem = t.kop.indexOf(kolomStem('VVD'));
		const strekking = t.kop.indexOf(KOLOM_STREKKING);
		expect(t.rijen.map((r) => r[stem])).toEqual(['voor', 'tegen']);
		expect(t.rijen.map((r) => r[strekking])).toEqual(['bevorderend', '']);
	});
});

describe('the counts of the API (0.79.30)', () => {
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

	it('turns the counts per kind and year around, with the vote of the fractie', () => {
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

	it('asks the list behind a number with exactly its filters', () => {
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

describe('the mark of an outcome', () => {
	it('is ja for passed, nee for rejected, open for the rest', () => {
		expect(
			['aangenomen', 'verworpen', 'overig', 'nog niet gestemd', null].map(outcomeShape)
		).toEqual(['ja', 'nee', 'open', 'open', 'open']);
	});
});
