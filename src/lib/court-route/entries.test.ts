import { describe, expect, it } from 'vitest';
import { entriesOf } from './entries';
import type { Routes } from './route';

const RO = 'BWBR0001830';
const RV = 'BWBR0001827';
const AWR = 'BWBR0002320';
const AWB = 'BWBR0005537';
const basis = (bwb_id: string, article_number: string) => ({ bwb_id, article_number });
const step = (
	tier: string,
	procedure: string,
	b: ReturnType<typeof basis>,
	designations = [] as ReturnType<typeof basis>[],
	after_tier: string | null = null
) => ({ tier, procedures: [procedure], after_tier, basis: b, designations });

// As API 0.80.39 answers, cut to what the entries read.
const ROUTES: Routes = {
	areas: [
		{
			area: 'civiel',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '42')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60')),
				step('hoge_raad', 'Cassatie', basis(RO, '78')),
				step('hoge_raad', 'Cassatie', basis(RO, '78'), [basis(RV, '398')], 'rechtbank'),
				step('gerechtshof', 'Verwijzing na Hoge Raad', basis(RV, '424'), [], 'hoge_raad')
			],
			gaps: []
		},
		{
			area: 'straf',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '45')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60')),
				step('hoge_raad', 'Cassatie', basis(RO, '78')),
				step('hoge_raad', 'Eerste en enige aanleg', basis(RO, '76')),
				step('gerechtshof', 'Verwijzing na Hoge Raad', basis('BWBR0001903', '440'), [], 'hoge_raad')
			],
			gaps: []
		},
		{
			area: 'bestuur',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(AWB, '8:6')),
				step('centrale_raad_van_beroep', 'Eerste aanleg', basis(AWB, '8:6'), [
					basis(AWB, 'bijlage 2 artikel 3')
				]),
				step('centrale_raad_van_beroep', 'Hoger beroep', basis(AWB, '8:105')),
				step(
					'hoge_raad',
					'Cassatie',
					basis(RO, '78'),
					[basis('BWBR0002221', '53')],
					'centrale_raad_van_beroep'
				)
			],
			gaps: []
		},
		{
			area: 'belasting',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '44')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60')),
				step('hoge_raad', 'Cassatie', basis(AWR, '28'), [basis(RO, '78')], 'rechtbank'),
				step('gerechtshof', 'Verwijzing na Hoge Raad', basis(AWR, '29e'), [], 'hoge_raad')
			],
			// Cassation after the hof not read: a gap, shown as one.
			gaps: [{ tier: 'hoge_raad', procedures: ['Cassatie'], why: 'not read' }]
		}
	],
	regeling: []
};
const names = (articles: { name: string; area?: string }[]) =>
	articles.map((a) => (a.area ? `${a.name} (${a.area})` : a.name));

describe('the entries into the Hoge Raad', () => {
	const { into, first, out } = entriesOf(ROUTES);

	it('names the court before it, the full lines first, by view and stage', () => {
		expect(into.map((e) => [e.name, e.stage, e.areas, e.via, e.dashed])).toEqual([
			['Gerechtshoven', 'hoger beroep', 'civiel en straf', 'cassatie', false],
			['Gerechtshoven', 'hoger beroep', 'belasting', 'cassatie', false],
			['Rechtbanken', 'eerste aanleg', 'civiel', 'sprongcassatie', true],
			['Rechtbanken', 'eerste aanleg', 'belasting', 'sprongcassatie', true],
			['Centrale Raad van Beroep', 'hoger beroep', 'bestuur', 'cassatie', true]
		]);
	});

	it('gives each entry the articles that open it, once where the areas agree', () => {
		expect(names(into[0].to.articles)).toEqual(['art. 78 RO']);
		expect(names(into[2].to.articles)).toEqual(['art. 78 RO', 'art. 398 Rv']);
		expect(names(into[3].to.articles)).toEqual(['art. 28 AWR', 'art. 78 RO']);
		expect(names(into[4].to.articles)).toEqual(['art. 78 RO', 'art. 53 AOW']);
	});

	it('shows an article not read as the gap, never filled', () => {
		expect(into[1].to).toMatchObject({ gap: true, articles: [] });
		expect(into[0].to.gap).toBe(false);
	});

	it('holds the Hoge Raad in first and only instance apart, with its article', () => {
		expect(first).toHaveLength(1);
		expect(first[0]).toMatchObject({ stage: 'Eerste en enige aanleg', areas: 'straf' });
		expect(names(first[0].court.articles)).toEqual(['art. 76 RO']);
	});

	it('names the court after verwijzing with the article of each area', () => {
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			stage: 'Verwijzing na Hoge Raad',
			areas: 'civiel, straf en belasting'
		});
		expect(out[0].court.name).toBe('Gerechtshoven');
		expect(names(out[0].court.articles)).toEqual([
			'art. 424 Rv (civiel)',
			'art. 440 Sv (straf)',
			'art. 29e AWR (belasting)'
		]);
	});

	it('is empty where the answer names no Hoge Raad', () => {
		expect(entriesOf({ areas: [], regeling: [] })).toEqual({ into: [], first: [], out: [] });
	});
});
