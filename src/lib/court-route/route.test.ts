import { describe, expect, it } from 'vitest';
import { VIEWS, designatedCourt, annexArticleName, routeOf, type Routes } from './route';

const RO = 'BWBR0001830';
const AWB = 'BWBR0005537';
const basis = (bwb_id: string, article_number: string) => ({ bwb_id, article_number });
const step = (
	tier: string,
	procedure: string,
	b: ReturnType<typeof basis>,
	designations = [] as ReturnType<typeof basis>[]
) => ({
	tier,
	procedures: [procedure],
	basis: b,
	designations
});
const ROUTES: Routes = {
	areas: [
		{
			area: 'civiel',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '42')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60'))
			],
			gaps: []
		},
		{
			area: 'straf',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '45')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60'))
			],
			gaps: []
		},
		{
			area: 'bestuur',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(AWB, '8:6')),
				step('raad_van_state', 'Eerste aanleg', basis(AWB, '8:6'), [
					basis(AWB, 'bijlage 2 artikel 2')
				]),
				step('centrale_raad_van_beroep', 'Hoger beroep', basis(AWB, '8:105'), [
					basis(AWB, 'bijlage 2 artikel 9')
				])
			],
			gaps: [
				{
					tier: 'hoge_raad',
					procedures: ['Cassatie'],
					why: 'Cassation against the Centrale Raad van Beroep: not read in the source.'
				}
			]
		},
		{
			area: 'belasting',
			steps: [step('rechtbank', 'Eerste aanleg', basis(RO, '44'))],
			gaps: [{ tier: 'hoge_raad', procedures: ['Cassatie'], why: 'not read' }]
		}
	],
	regeling: []
};
const view = (id: string) => VIEWS.find((v) => v.id === id)!;

describe('the route of a view', () => {
	it('shows a gap after all courts of a stage as a stage of its own', () => {
		const { stages } = routeOf(view('belasting'), ROUTES);
		expect(stages.map((s) => s.name)).toEqual(['Eerste aanleg', 'Cassatie']);
		expect(stages[1].courts[0]).toMatchObject({ name: 'Hoge Raad', gap: true, articles: [] });
	});

	it('names an article per area where the areas differ, once where they agree', () => {
		const { stages } = routeOf(view('civiel'), ROUTES);
		expect(stages.map((s) => s.name)).toEqual(['Eerste aanleg', 'Hoger beroep']);
		expect(stages[0].courts[0].articles.map((a) => [a.name, a.area])).toEqual([
			['art. 42 RO', 'civiel'],
			['art. 45 RO', 'straf']
		]);
		expect(stages[1].courts[0].articles.map((a) => [a.name, a.area])).toEqual([
			['art. 60 RO', undefined]
		]);
	});

	it('puts a bijzondere bestuursrechter in first instance apart, and shows a gap as one', () => {
		const { stages, others } = routeOf(view('bestuur'), ROUTES);
		expect(stages.map((s) => [s.name, s.courts.map((c) => c.name)])).toEqual([
			['Eerste aanleg', ['Rechtbanken']],
			['Hoger beroep', ['Centrale Raad van Beroep']]
		]);
		expect(stages[1].courts[0].articles.map((a) => a.name)).toEqual([
			'art. 8:105 Awb',
			'art. 9 bijlage 2 Awb'
		]);
		// Cassation lies against the CRvB alone: a line under it, not a stage after all three.
		expect(stages[1].courts[0].then).toMatchObject({
			name: 'Hoge Raad',
			stage: 'Cassatie',
			gap: true,
			articles: []
		});
		expect(others.map((c) => [c.name, c.articles.map((a) => a.ref.key)])).toEqual([
			[
				'Afdeling bestuursrechtspraak van de Raad van State',
				['bwbr0005537_8_6', 'bwbr0005537_bijlage_2_artikel_2']
			]
		]);
	});
});

describe('the regeling', () => {
	it('names the court an article names, and the article by its number', () => {
		expect(designatedCourt(ROUTES, 'bijlage 2 artikel 9')).toBe('Centrale Raad van Beroep');
		expect(designatedCourt(ROUTES, 'bijlage 2 artikel 1')).toBeNull();
		expect(annexArticleName('bijlage 2 artikel 10')).toBe('Artikel 10');
	});
});
