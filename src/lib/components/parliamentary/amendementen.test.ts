import { describe, expect, it } from 'vitest';
import {
	aantalAmendementen,
	besluitSoort,
	dienstregeling,
	inStemming,
	kiesBesluit,
	kolomVan,
	maandagVan,
	stappen,
	type Graph
} from './amendementen';

const stuk = (n: string, datum: string, kast: string, actors: object[] = []) => ({
	id: `documents/d${n}`,
	key: `d${n}`,
	props: {
		sequence: Number(n),
		date: datum,
		title: `Amendement nr. ${n}`,
		case_kinds: ['Amendement'],
		case_ids: [kast],
		actors
	}
});
const besluit = (kast: string, passed: boolean, voor: number, tegen: number) => ({
	id: `decisions/b-${kast}`,
	key: `b-${kast}`,
	props: {
		primary_case_id: kast,
		passed,
		date: '2024-04-25',
		tally: { Voor: voor, Tegen: tegen },
		case_ids: ['x', kast]
	}
});
const herziet = (nieuw: string, oud: string) => ({
	source: `documents/d${nieuw}`,
	target: `documents/d${oud}`,
	relation: 'REVISES'
});

// 22 → 30 → 40, voted as 40; 26 and 38 merged into 48; 6 alone; 60 never voted.
const graaf: Graph = {
	nodes: [
		stuk('6', '2024-02-09', 'k6'),
		stuk('22', '2024-04-19', 'k22', [
			{ name: 'De Hoop', faction: 'GL-PvdA', role: 'Eerste ondertekenaar' },
			{ name: 'Vedder', faction: 'CDA', role: 'Medeondertekenaar' }
		]),
		stuk('30', '2024-04-22', 'k30'),
		stuk('40', '2024-04-23', 'k40', [
			{ name: 'Vedder', faction: 'CDA', role: 'Medeondertekenaar' },
			{ name: 'De Hoop', faction: 'GL-PvdA', role: 'Eerste ondertekenaar' }
		]),
		stuk('26', '2024-04-22', 'k26'),
		stuk('38', '2024-04-22', 'k38'),
		stuk('48', '2024-04-24', 'k48'),
		stuk('60', '2024-04-24', 'k60'),
		{
			id: 'documents/brief',
			key: 'brief',
			props: { case_kinds: ['Wetgeving'], date: '2024-01-01' }
		},
		besluit('k6', false, 36, 114),
		besluit('k40', true, 92, 58),
		besluit('k48', true, 113, 37)
	],
	edges: [herziet('30', '22'), herziet('40', '30'), herziet('48', '26'), herziet('48', '38')]
};

describe('the timetable of the amendementen', () => {
	const d = dienstregeling(graaf);

	it('gives a row per amendement as it came to the vote, with the stukken it grew from', () => {
		expect(d.rijen.map((r) => r.stuk.nummer)).toEqual(['6', '40', '48', '60']);
		const r = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(r.haltes.map((h) => h.nummer)).toEqual(['22', '30', '40']);
		expect(d.metVervanging).toBe(true);
	});

	it('takes the outcome from the besluit on the zaak of the last stuk, nothing from the title', () => {
		const r = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(r.uitslag).toMatchObject({
			aangenomen: true,
			telling: '92–58',
			datum: '2024-04-25'
		});
		expect(d.rijen.find((x) => x.stuk.nummer === '60')!.uitslag).toBeNull();
	});

	it('fills the stop that came to the vote, and leaves the others open', () => {
		const gevuld = (nummer: string) => {
			const r = d.rijen.find((x) => x.stuk.nummer === nummer)!;
			return r.haltes.filter((h) => h.id === inStemming(r)).map((h) => h.nummer);
		};
		// 22 → 30 → 40, voted as 40: only 40 is filled.
		expect(gevuld('40')).toEqual(['40']);
		expect(gevuld('48')).toEqual(['48']);
		expect(gevuld('6')).toEqual(['6']);
		// Never voted: every stop open.
		expect(gevuld('60')).toEqual([]);
	});

	it('fills no stop for a besluit without an outcome (ingetrokken)', () => {
		const ingetrokken = dienstregeling({
			nodes: [
				stuk('70', '2024-04-24', 'k70'),
				{
					id: 'decisions/b-k70',
					key: 'b-k70',
					props: {
						primary_case_id: 'k70',
						date: '2024-04-25',
						decision_kind: 'Stemmen - ingetrokken'
					}
				}
			],
			edges: []
		});
		expect(ingetrokken.rijen[0].uitslag?.soort).toBe('ingetrokken');
		expect(inStemming(ingetrokken.rijen[0])).toBeNull();
	});

	it('marks samengevoegd where two chains end in one stuk', () => {
		const r = d.rijen.find((x) => x.stuk.nummer === '48')!;
		expect(r.samengevoegd).toBe(true);
		expect(r.haltes.map((h) => h.nummer)).toEqual(['26', '38', '48']);
	});

	it('names the first ondertekenaar from the actors, with the number of others', () => {
		expect(d.rijen.find((x) => x.stuk.nummer === '40')!.indiener).toEqual({
			naam: 'De Hoop',
			fractie: 'GL-PvdA',
			anderen: 1
		});
	});

	it('makes the columns days, or weeks above fourteen days', () => {
		expect(d.kolommen).toEqual([
			'2024-02-09',
			'2024-04-19',
			'2024-04-22',
			'2024-04-23',
			'2024-04-24'
		]);
		expect(maandagVan('2024-04-25')).toBe('2024-04-22');
		expect(kolomVan(d, '2024-04-22')).toBe('2024-04-22');
	});

	it('draws the route: ingediend, gewijzigd, and samengevoegd where chains meet', () => {
		const r40 = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(stappen(r40).map((s) => `${s.wat} ${s.stukken.map((h) => h.nummer).join('+')}`)).toEqual(
			['ingediend 22', 'gewijzigd 30', 'gewijzigd 40']
		);
		const r48 = d.rijen.find((x) => x.stuk.nummer === '48')!;
		expect(stappen(r48).map((s) => `${s.wat} ${s.stukken.map((h) => h.nummer).join('+')}`)).toEqual(
			['ingediend 26+38', 'samengevoegd 48']
		);
	});

	it('keeps every stuk apart without REVISES', () => {
		const zonder = dienstregeling({ ...graaf, edges: [] });
		expect(zonder.metVervanging).toBe(false);
		expect(zonder.rijen).toHaveLength(8);
	});

	it('counts the amendementen from the dossier’s own count per kind', () => {
		expect(
			aantalAmendementen({
				Amendement: 25,
				'Amendement (gewijzigd/nader/vervangend)': 26,
				Motie: 20
			})
		).toBe(51);
		expect(aantalAmendementen(null)).toBe(0);
	});
});

describe('besluiten without a vote (gap 2, BesluitSoort)', () => {
	const b = (id: string, date: string, passed: boolean | null, decision_kind: string) => ({
		id: `decisions/${id}`,
		key: id,
		props: { primary_case_id: 'k', date, passed, decision_kind }
	});

	it('names the kind as the Kamer decided, never "gestemd"', () => {
		expect(besluitSoort('Stemmen - ingetrokken')).toBe('ingetrokken');
		expect(besluitSoort('Aanhouden')).toBe('aangehouden');
		expect(besluitSoort('Stemmen - aangehouden')).toBe('aangehouden');
		expect(besluitSoort('Uitstellen')).toBe('uitgesteld');
		expect(besluitSoort('Vervallen')).toBe('vervallen');
		expect(besluitSoort('Stemmen - aangenomen')).toBeNull();
		expect(besluitSoort('Stemmen')).toBeNull();
		expect(besluitSoort(null)).toBeNull();
	});

	it('chooses, of several besluiten, the last with an outcome, else the last', () => {
		const uitgesteld = b('u', '2024-04-18', null, 'Uitstellen');
		const gestemd = b('g', '2024-04-23', true, 'Stemmen - aangenomen');
		const aangehouden = b('a', '2024-04-25', null, 'Stemmen - aangehouden');
		expect(kiesBesluit([uitgesteld, aangehouden, gestemd])?.id).toBe('decisions/g');
		expect(kiesBesluit([uitgesteld, aangehouden])?.id).toBe('decisions/a');
		expect(kiesBesluit([])).toBeNull();
	});

	it('gives an ingetrokken amendement its word, and a replaced stuk its successor', () => {
		const g: Graph = {
			nodes: [
				...graaf.nodes,
				{
					id: 'decisions/b-k60',
					key: 'b-k60',
					props: {
						primary_case_id: 'k60',
						date: '2024-04-25',
						passed: null,
						decision_kind: 'Stemmen - ingetrokken'
					}
				}
			],
			edges: graaf.edges
		};
		const d = dienstregeling(g);
		expect(d.rijen.find((r) => r.stuk.nummer === '60')!.uitslag).toMatchObject({
			aangenomen: null,
			soort: 'ingetrokken'
		});
		const r40 = d.rijen.find((r) => r.stuk.nummer === '40')!;
		expect(r40.haltes.map((h) => h.vervangenDoor)).toEqual(['30', '40', null]);
	});

	it('says "nog niet gestemd" where the zaak is not done and has no besluit', () => {
		const g: Graph = {
			nodes: [
				...graaf.nodes,
				{ id: 'cases/k60', key: 'k60', props: { external_id: 'k60', done: false } }
			],
			edges: graaf.edges
		};
		expect(dienstregeling(g).rijen.find((r) => r.stuk.nummer === '60')!.nogNiet).toBe(true);
	});
});
