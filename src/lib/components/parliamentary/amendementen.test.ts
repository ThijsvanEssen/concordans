import { describe, expect, it } from 'vitest';
import {
	aantalAmendementen,
	dienstregeling,
	kolomVan,
	maandagVan,
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

describe('dienstregeling van de amendementen', () => {
	const d = dienstregeling(graaf);

	it('een rij per amendement zoals het in stemming kwam, met de stukken waaruit het groeide', () => {
		expect(d.rijen.map((r) => r.stuk.nummer)).toEqual(['6', '40', '48', '60']);
		const r = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(r.haltes.map((h) => h.nummer)).toEqual(['22', '30', '40']);
		expect(d.metVervanging).toBe(true);
	});

	it('de uitslag is het besluit op de zaak van het laatste stuk, niets uit de titel', () => {
		const r = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(r.uitslag).toMatchObject({ aangenomen: true, voor: 92, tegen: 58 });
		expect(d.rijen.find((x) => x.stuk.nummer === '60')!.uitslag).toBeNull();
	});

	it('samengevoegd waar twee ketens in één stuk uitkomen', () => {
		const r = d.rijen.find((x) => x.stuk.nummer === '48')!;
		expect(r.samengevoegd).toBe(true);
		expect(r.haltes.map((h) => h.nummer)).toEqual(['26', '38', '48']);
	});

	it('de eerste ondertekenaar uit de actoren, met het aantal anderen', () => {
		expect(d.rijen.find((x) => x.stuk.nummer === '40')!.indiener).toEqual({
			naam: 'De Hoop',
			fractie: 'GL-PvdA',
			anderen: 1
		});
	});

	it('kolommen zijn de dagen, of weken boven veertien dagen', () => {
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

	it('zonder REVISES staat elk stuk apart', () => {
		const zonder = dienstregeling({ ...graaf, edges: [] });
		expect(zonder.metVervanging).toBe(false);
		expect(zonder.rijen).toHaveLength(8);
	});

	it('telt de amendementen uit de eigen telling per soort van het dossier', () => {
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
