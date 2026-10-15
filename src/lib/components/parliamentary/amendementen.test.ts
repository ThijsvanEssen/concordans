import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	aantalAmendementen,
	besluitSoort,
	dienstregeling,
	inStemming,
	kolomVan,
	maandagVan,
	stappen
} from './amendementen';

type Antwoord = Schema<'AmendmentChainsResponse'>;
type Keten = Antwoord['chains'][number];
type Besluit = NonNullable<Keten['decision']>;

const DATUM: Record<string, string> = {
	'6': '2024-02-09',
	'22': '2024-04-19',
	'30': '2024-04-22',
	'40': '2024-04-23',
	'26': '2024-04-22',
	'38': '2024-04-22',
	'48': '2024-04-24',
	'60': '2024-04-24',
	'70': '2024-04-24'
};
const id = (n: string) => `documents/d${n}`;

/** A chain of papers as the API gives it: `vorige` maps a paper to those it replaces. */
const keten = (
	nrs: string[],
	vorige: Record<string, string[]> = {},
	extra: Partial<Keten> = {}
): Keten => {
	const opvolger = (n: string) => nrs.filter((m) => vorige[m]?.includes(n)).map(id);
	return {
		id: id(nrs.at(-1)!),
		first_date: DATUM[nrs[0]],
		outcome: 'other',
		merged: nrs.filter((n) => !vorige[n]?.length).length > 1,
		documents: nrs.map((n) => ({
			id: id(n),
			key: `d${n}`,
			number: n,
			date: DATUM[n],
			title: `Amendement nr. ${n}`,
			replaces: (vorige[n] ?? []).map(id),
			replaced_by: opvolger(n),
			path: null
		})),
		submitters: [],
		decision: null,
		waiting: false,
		...extra
	};
};
const besluit = (nr: string, passed: boolean | null, rest: Partial<Besluit> = {}): Besluit => ({
	id: `decisions/b-${nr}`,
	key: `b-${nr}`,
	date: '2024-04-25',
	passed,
	outcome: passed === true ? 'aangenomen' : passed === false ? 'verworpen' : null,
	decision_kind: null,
	tally: null,
	path: null,
	...rest
});
const indiener = (name: string, faction: string, role: 'indiener' | 'medeindiener') => ({
	name,
	faction,
	member_key: null,
	role,
	path: null
});

// 22 → 30 → 40, voted as 40; 26 and 38 merged into 48; 6 alone; 60 never voted.
const antwoord: Antwoord = {
	number: '36000',
	chains: [
		keten(['6'], {}, { decision: besluit('6', false, { tally: { Voor: 36, Tegen: 114 } }) }),
		keten(
			['22', '30', '40'],
			{ '30': ['22'], '40': ['30'] },
			{
				decision: besluit('40', true, { tally: { Voor: 92, Tegen: 58 } }),
				submitters: [
					indiener('De Hoop', 'GL-PvdA', 'indiener'),
					indiener('Vedder', 'CDA', 'medeindiener')
				]
			}
		),
		keten(
			['26', '38', '48'],
			{ '48': ['26', '38'] },
			{ decision: besluit('48', true, { tally: { Voor: 113, Tegen: 37 } }) }
		),
		keten(['60'])
	]
};

describe('the timetable of the amendementen', () => {
	const d = dienstregeling(antwoord);

	it('gives a row per amendement as it came to the vote, with the stukken it grew from', () => {
		expect(d.rijen.map((r) => r.stuk.nummer)).toEqual(['6', '40', '48', '60']);
		const r = d.rijen.find((x) => x.stuk.nummer === '40')!;
		expect(r.haltes.map((h) => h.nummer)).toEqual(['22', '30', '40']);
		expect(d.metVervanging).toBe(true);
	});

	it('takes the outcome from the besluit of the chain, nothing from the title', () => {
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
			number: '36000',
			chains: [
				keten(
					['70'],
					{},
					{
						decision: besluit('70', null, {
							outcome: 'ingetrokken',
							decision_kind: 'Stemmen - ingetrokken'
						})
					}
				)
			]
		});
		expect(ingetrokken.rijen[0].uitslag?.soort).toBe('ingetrokken');
		expect(inStemming(ingetrokken.rijen[0])).toBeNull();
	});

	it('marks samengevoegd where two chains end in one stuk', () => {
		const r = d.rijen.find((x) => x.stuk.nummer === '48')!;
		expect(r.samengevoegd).toBe(true);
		expect(r.haltes.map((h) => h.nummer)).toEqual(['26', '38', '48']);
	});

	it('names the indiener, with the number of medeindieners', () => {
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
		const zonder = dienstregeling({
			number: '36000',
			chains: Object.keys(DATUM).map((n) => keten([n]))
		});
		expect(zonder.metVervanging).toBe(false);
		expect(zonder.rijen).toHaveLength(9);
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

	it('gives an ingetrokken amendement its word, and a replaced stuk its successor', () => {
		const d = dienstregeling({
			number: '36000',
			chains: [
				...antwoord.chains.slice(0, 3),
				keten(
					['60'],
					{},
					{
						decision: besluit('60', null, {
							outcome: 'ingetrokken',
							decision_kind: 'Stemmen - ingetrokken'
						})
					}
				)
			]
		});
		expect(d.rijen.find((r) => r.stuk.nummer === '60')!.uitslag).toMatchObject({
			aangenomen: null,
			soort: 'ingetrokken'
		});
		const r40 = d.rijen.find((r) => r.stuk.nummer === '40')!;
		expect(r40.haltes.map((h) => h.vervangenDoor)).toEqual(['30', '40', null]);
	});

	it('names a postponement by its BesluitSoort, where the API gives no outcome', () => {
		const d = dienstregeling({
			number: '36000',
			chains: [
				keten(
					['60'],
					{},
					{
						decision: besluit('60', null, { decision_kind: 'Stemmen - uitstellen' })
					}
				)
			]
		});
		expect(d.rijen[0].uitslag?.soort).toBe('uitgesteld');
	});

	it('says "nog niet gestemd" where the API says the chain waits', () => {
		const d = dienstregeling({ number: '36000', chains: [keten(['60'], {}, { waiting: true })] });
		expect(d.rijen[0].nogNiet).toBe(true);
	});
});
