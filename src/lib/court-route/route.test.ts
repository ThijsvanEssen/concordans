import { describe, expect, it } from 'vitest';
import { nodeKey } from '$lib/text/node-key';
import { VIEWS, arrowInto, designatedCourt, annexArticleName, routeOf, type Routes } from './route';

const RO = 'BWBR0001830';
const AWB = 'BWBR0005537';
const basis = (bwb_id: string, article_number: string) => ({
	bwb_id,
	article_number,
	key: nodeKey(bwb_id, article_number)
});
const step = (
	tier: string,
	procedure: string,
	b: ReturnType<typeof basis>,
	designations = [] as ReturnType<typeof basis>[],
	after_tier: string | null = null
) => ({ tier, procedures: [procedure], after_tier, basis: b, designations });
const article = (n: string, heading: string | null = null) => ({
	number: `bijlage 2 artikel ${n}`,
	key: `bwbr0005537_bijlage_2_artikel_${n}`,
	heading,
	laws: []
});
const ROUTES: Routes = {
	areas: [
		{
			area: 'civiel',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '42')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60')),
				// Sprongcassatie: in the schema of the entries, not a stage of the view.
				step('hoge_raad', 'Cassatie', basis(RO, '78'), [basis('BWBR0001827', '398')], 'rechtbank')
			],
			gaps: []
		},
		{
			area: 'straf',
			steps: [
				step('rechtbank', 'Eerste aanleg', basis(RO, '45')),
				step('gerechtshof', 'Hoger beroep', basis(RO, '60')),
				step('hoge_raad', 'Eerste en enige aanleg', basis(RO, '76'))
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
				step('centrale_raad_van_beroep', 'Eerste aanleg', basis(AWB, '8:6'), [
					basis(AWB, 'bijlage 2 artikel 3')
				]),
				step('raad_van_state', 'Hoger beroep', basis(AWB, '8:105')),
				step('centrale_raad_van_beroep', 'Hoger beroep', basis(AWB, '8:105'), [
					basis(AWB, 'bijlage 2 artikel 9')
				]),
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
				step('gerechtshof', 'Hoger beroep', basis(RO, '60'), [basis(AWB, 'bijlage 2 artikel 12')])
			],
			gaps: [{ tier: 'hoge_raad', procedures: ['Cassatie'], why: 'not read' }]
		}
	],
	regeling: [
		{ label: 'Hoofdstuk 1', title: null, articles: [article('1', 'Geen beroep')] },
		{ label: 'Hoofdstuk 2', title: null, articles: [article('2'), article('3')] },
		{ label: 'Hoofdstuk 4', title: null, articles: [article('9'), article('12')] }
	]
};
const view = (id: string) => VIEWS.find((v) => v.id === id)!;
const rows = (id: string) =>
	routeOf(view(id), ROUTES).map((s) => [
		s.name,
		s.rows.map((r) => [r.when, r.none ?? r.courts.map((c) => c.name).join(', ')])
	]);

describe('the route of a view', () => {
	it('shows a gap as a court of its stage, without articles', () => {
		const stages = routeOf(view('belasting'), ROUTES);
		expect(stages.map((s) => s.name)).toEqual(['Eerste aanleg', 'Hoger beroep', 'Cassatie']);
		expect(stages[2].rows[0].courts[0]).toMatchObject({
			name: 'Hoge Raad',
			gap: true,
			articles: []
		});
	});

	it('names an article per area where the areas differ, once where they agree', () => {
		const stages = routeOf(view('civiel'), ROUTES);
		const [first, appeal] = stages.map((s) => s.rows[0].courts[0].articles);
		expect(first.map((a) => [a.name, a.area])).toEqual([
			['art. 42 RO', 'civiel'],
			['art. 45 RO', 'straf']
		]);
		expect(appeal.map((a) => [a.name, a.area])).toEqual([['art. 60 RO', undefined]]);
	});

	it('leaves the entries into the Hoge Raad off the main route to their own schema', () => {
		expect(rows('civiel')).toEqual([
			['Eerste aanleg', [[null, 'Rechtbanken']]],
			['Hoger beroep', [[null, 'Gerechtshoven']]]
		]);
	});

	it('gives a stage of one row no condition, whatever names its court', () => {
		expect(rows('belasting')[1]).toEqual(['Hoger beroep', [[null, 'Gerechtshoven']]]);
	});

	it('shows bestuursrecht as rows "als … / anders", the excepted besluit first', () => {
		expect(rows('bestuur')).toEqual([
			[
				'Eerste aanleg',
				[
					['als het besluit is uitgezonderd', 'Geen beroep'],
					[
						'als de rechter is aangewezen, hoofdstuk 2 bijlage 2',
						'Afdeling bestuursrechtspraak van de Raad van State, Centrale Raad van Beroep'
					],
					['anders', 'Rechtbanken']
				]
			],
			[
				'Hoger beroep',
				[
					['als de rechter is aangewezen, hoofdstuk 4 bijlage 2', 'Centrale Raad van Beroep'],
					['anders', 'Afdeling bestuursrechtspraak van de Raad van State']
				]
			],
			['Cassatie', [['alleen in enkele zaken', 'Hoge Raad']]]
		]);
		const [first] = routeOf(view('bestuur'), ROUTES);
		expect(first.rows[0].cite).toMatchObject({
			name: 'art. 1 bijlage 2 Awb',
			ref: { key: 'bwbr0005537_bijlage_2_artikel_1' }
		});
	});

	it('gives cassation after the Centrale Raad van Beroep alone a card of its own, last', () => {
		const stages = routeOf(view('bestuur'), ROUTES);
		const cassation = stages.at(-1)!;
		expect(stages).toHaveLength(3);
		expect(cassation).toMatchObject({ name: 'Cassatie', after: 'Centrale Raad van Beroep' });
		expect(cassation.rows).toHaveLength(1);
		expect(cassation.rows[0].when).toBe('alleen in enkele zaken');
		const [court] = cassation.rows[0].courts;
		expect(court).toMatchObject({ name: 'Hoge Raad', gap: false });
		expect(court.articles.map((a) => a.name)).toEqual(['art. 78 RO', 'art. 53 AOW']);
		expect(arrowInto(cassation, stages[1])).toBe('cassatie, alleen na de Centrale Raad van Beroep');
	});

	it('names the arrow after the court of "anders" alone', () => {
		const [first, appeal] = routeOf(view('bestuur'), ROUTES);
		expect(arrowInto(appeal, first)).toBe('hoger beroep, na de rechtbank');
		const [civil, civilAppeal] = routeOf(view('civiel'), ROUTES);
		expect(arrowInto(civilAppeal, civil)).toBe('hoger beroep');
	});
});

describe('the regeling', () => {
	it('names the court an article names, and the article by its number', () => {
		expect(designatedCourt(ROUTES, 'bijlage 2 artikel 9')).toBe('Centrale Raad van Beroep');
		expect(designatedCourt(ROUTES, 'bijlage 2 artikel 1')).toBeNull();
		expect(annexArticleName('bijlage 2 artikel 10')).toBe('Artikel 10');
	});
});
