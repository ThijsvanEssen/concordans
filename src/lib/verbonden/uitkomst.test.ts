// The outcome of a judgment in the list "Uitspraken die dit artikel aanhalen": never left out,
// and in a strafzaak the first clause of a hof or a rechtbank is no verdict.
import { describe, expect, it } from 'vitest';
import { rowsOfCitedBy } from './cited-by';
import { metaParts } from './rows';
import { isStrafGroep, NIET_VASTGESTELD, uitkomstVan } from './uitkomst';

const item = (judgment: Record<string, unknown>) =>
	({
		judgment: {
			key: 'ecli_nl_x_2020_1',
			ecli: 'ECLI:NL:X:2020:1',
			date: '2020-01-10',
			...judgment
		},
		paragraph_number: '3.1',
		text: 'artikel 3:4',
		confidence: 1,
		leden: [],
		snippet: ''
	}) as never;

const meta = (judgment: Record<string, unknown>, straf = false) =>
	metaParts(rowsOfCitedBy([item(judgment)], false, straf)[0], true);

describe('uitkomstVan', () => {
	it('says an outcome in a word, with the clause at hover', () => {
		expect(
			uitkomstVan({ outcome: 'ongegrond', outcome_text: 'verklaart het beroep ongegrond' }, false)
		).toEqual({
			text: 'Ongegrond',
			title: 'verklaart het beroep ongegrond',
			vastgesteld: true
		});
	});

	it('says null as not established, never nothing', () => {
		expect(uitkomstVan({ outcome: null }, true)).toMatchObject({
			text: NIET_VASTGESTELD,
			vastgesteld: false
		});
		expect(uitkomstVan({}, false).text).toBe('Uitkomst niet vastgesteld');
	});

	it('says what a conclusion proposes', () => {
		expect(uitkomstVan({ outcome: null, conclusion_outcome: 'verwerping' }, true).text).toBe(
			'Strekt tot verwerping'
		);
	});

	it('does not show vernietigd of a hof or niet-ontvankelijk of a rechtbank in a strafzaak as a verdict', () => {
		const hof = uitkomstVan({ outcome: 'vernietigd', tier: 'gerechtshof' }, true);
		expect(hof.text).toMatch(/^Vonnis vernietigd, zegt niets over veroordeling$/);
		const rb = uitkomstVan({ outcome: 'niet-ontvankelijk', tier: 'rechtbank' }, true);
		expect(rb.text).toMatch(/zegt niets over veroordeling/);
	});

	it('leaves the same words bare outside a strafzaak and for other courts', () => {
		expect(uitkomstVan({ outcome: 'vernietigd', tier: 'gerechtshof' }, false).text).toBe(
			'Vernietigd'
		);
		expect(uitkomstVan({ outcome: 'vernietigd', tier: 'hoge_raad' }, true).text).toBe('Vernietigd');
		expect(uitkomstVan({ outcome: 'bekrachtigd', tier: 'gerechtshof' }, true).text).toBe(
			'Bekrachtigd'
		);
	});
});

describe('isStrafGroep', () => {
	const facet = [
		{ value: 'Strafrecht', count: 620 },
		{ value: 'Bestuursrecht', count: 9 }
	];
	it('is the filter when there is one, else the larger half of the group', () => {
		expect(isStrafGroep('Bestuursrecht', facet, 629)).toBe(false);
		expect(isStrafGroep('Strafrecht', undefined, 0)).toBe(true);
		expect(isStrafGroep(undefined, facet, 629)).toBe(true);
		expect(isStrafGroep(undefined, [{ value: 'Bestuursrecht', count: 5 }], 5)).toBe(false);
		expect(isStrafGroep(undefined, undefined, 0)).toBe(false);
	});
});

describe('the meta line of a row of Uitspraken', () => {
	it('starts with the outcome, then the ECLI, and has one for every row', () => {
		const known = meta({ outcome: 'bevestigd', tier: 'gerechtshof' });
		expect(known.map((p) => p.text)).toEqual(['Bevestigd', 'X:2020:1']);
		const unknown = meta({ outcome: null });
		expect(unknown[0]).toMatchObject({ text: NIET_VASTGESTELD, kind: 'onbekend' });
	});
});
