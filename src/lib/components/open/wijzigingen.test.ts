import { describe, expect, it } from 'vitest';
import { CHANGE_RELATIONS } from '$lib/vocabulary';
import { brengersVan, wijzigingenVan } from './wijzigingen';

const artikel = (
	key: string,
	nummer: string,
	relation: string,
	effect: string,
	positie: number,
	bwb = 'BWBR0009950',
	titel = 'Telecommunicatiewet'
) => ({
	key,
	collection: 'articles',
	relation,
	direction: 'outbound',
	props: {
		article_number: nummer,
		bwb_id: bwb,
		instrument_citation_title: titel,
		position: positie
	},
	meta: { effect, effective_date: '2026-08-15' }
});

describe('what a publication changes, per law and verb', () => {
	it('groups the articles per law and verb, in the law’s order, with the words of hoe.ts', () => {
		const regels = wijzigingenVan([
			artikel('t_11a_3', '11a.3', 'AMENDS', 'wijziging', 30),
			artikel(
				'w_2',
				'2',
				'AMENDS',
				'wijziging',
				2,
				'BWBR0041931',
				'Wet bekostiging financieel toezicht 2019'
			),
			artikel('t_11a_2a', '11a.2a', 'REPEALS', 'vervallen', 29),
			artikel('t_11a_2', '11a.2', 'REPEALS', 'vervallen', 28),
			artikel('t_1_1', '1.1', 'AMENDS', 'wijziging', 1)
		]);
		expect(regels.map((r) => [r.werkwoord, r.wet.titel, r.artikelen.map((a) => a.nummer)])).toEqual(
			[
				['Wijzigt', 'Telecommunicatiewet', ['1.1', '11a.3']],
				['Doet vervallen', 'Telecommunicatiewet', ['11a.2', '11a.2a']],
				['Wijzigt', 'Wet bekostiging financieel toezicht 2019', ['2']]
			]
		);
		expect(regels[0].wet.key).toBe('bwbr0009950');
	});

	it('reads the verb from the effect, as the row of Verbonden does', () => {
		const [r] = wijzigingenVan([artikel('t_5', '5', 'AMENDS', 'nieuw', 5)]);
		expect(r.werkwoord).toBe('Voegt in');
	});

	it('orders the lines of a law by the relation: Stelt vast, Wijzigt, Voegt in, Doet vervallen', () => {
		const regels = wijzigingenVan([
			artikel('t_4', '4', 'REPEALS', 'vervallen', 4),
			artikel('t_3', '3', 'AMENDS', 'nieuw', 3),
			artikel('t_2', '2', 'AMENDS', 'wijziging', 2),
			artikel('t_1', '1', 'ESTABLISHES', 'nieuwe-regeling', 1)
		]);
		expect(regels.map((r) => r.werkwoord)).toEqual([
			'Stelt vast',
			'Wijzigt',
			'Voegt in',
			'Doet vervallen'
		]);
		expect(regels.map((r) => r.relation)).toEqual(CHANGE_RELATIONS);
	});

	it('says Vernummert for a renumbering', () => {
		const [r] = wijzigingenVan([artikel('t_6', '6', 'AMENDS', 'vernummering', 6)]);
		expect(r.werkwoord).toBe('Vernummert');
	});

	it('names a few articles and counts the rest', () => {
		const veel = Array.from({ length: 15 }, (_, n) =>
			artikel(`t_${n}`, String(n + 1), 'AMENDS', 'wijziging', n)
		);
		const [r] = wijzigingenVan(veel, [], 12);
		expect(r.artikelen).toHaveLength(12);
		expect(r.meer).toBe(3);
	});

	it('takes the law’s title from the feed where the article lacks it; leaves inbound edges out', () => {
		const zonder = {
			...artikel('x_1', '1', 'AMENDS', 'wijziging', 1),
			props: { article_number: '1', bwb_id: 'BWBR0045574' }
		};
		const [r] = wijzigingenVan(
			[zonder, { ...artikel('y', '2', 'AMENDS', 'wijziging', 2), direction: 'inbound' }],
			[{ key: 'bwbr0045574', title: 'Regeling inburgering 2021' }]
		);
		expect(r.wet.titel).toBe('Regeling inburgering 2021');
		expect(wijzigingenVan([])).toEqual([]);
	});
});

describe('the publication that brought a version', () => {
	const pub = {
		id: 'instruments/stcrt_2026_35238',
		key: 'stcrt_2026_35238',
		identifier: 'stcrt_2026_35238',
		display_name: 'Stcrt. 2026, 35238',
		amends: 1,
		introduces: 7,
		repeals: 0,
		articles_affected: 8,
		first_effective_date: '2026-10-06'
	};

	it('is the one whose first change takes effect that day, with what it did', () => {
		expect(brengersVan([pub as never], '2026-10-06')).toEqual([
			{
				key: 'stcrt_2026_35238',
				naam: 'Stcrt. 2026, 35238',
				wat: 'wijzigt 1 artikel, voegt 7 artikelen in'
			}
		]);
		expect(
			brengersVan([{ ...pub, amends: 0, introduces: 0, repeals: 2 } as never], '2026-10-06')[0].wat
		).toBe('doet 2 artikelen vervallen');
		// The publication that enacted the law (ESTABLISHES, API 0.79.55).
		expect(
			brengersVan(
				[{ ...pub, amends: 0, introduces: 0, establishes: 111 } as never],
				'2026-10-06'
			)[0].wat
		).toBe('stelt 111 artikelen vast');
	});

	it('is none on another day, or for a new law the data does not link', () => {
		expect(brengersVan([pub as never], '2026-08-15')).toEqual([]);
		expect(brengersVan([{ ...pub, first_effective_date: null } as never], '2026-10-06')).toEqual(
			[]
		);
	});
});
