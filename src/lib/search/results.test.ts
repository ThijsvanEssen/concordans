import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	conceptOf,
	judgmentFacets,
	narrowerWords,
	onlyJudgments,
	pageOf,
	resultsHref
} from './results';

type Hit = Schema<'SearchResultItem'>;
const judgment = (ecli: string): Hit =>
	({ id: `judgments/${ecli}`, collection: 'judgments', extra: { ecli } }) as unknown as Hit;

const hits = [
	judgment('ECLI:NL:HR:2005:AU3313'),
	judgment('ECLI:NL:HR:2019:1'),
	judgment('ECLI:NL:RBAMS:2019:2')
];

describe('the results page', () => {
	it('counts courts and years of judgments from their ECLI', () => {
		const { courts, years } = judgmentFacets(hits);
		expect([...courts]).toEqual([
			['HR', 2],
			['RBAMS', 1]
		]);
		expect([...years]).toEqual([
			['2019', 2],
			['2005', 1]
		]);
	});

	it('narrows judgments by court and year, either or both', () => {
		expect(onlyJudgments(hits, 'HR', '')).toHaveLength(2);
		expect(onlyJudgments(hits, '', '2019')).toHaveLength(2);
		expect(onlyJudgments(hits, 'HR', '2019')).toHaveLength(1);
		expect(onlyJudgments(hits, '', '')).toHaveLength(3);
	});

	it('pages within the pages there are', () => {
		const rows = Array.from({ length: 45 }, (_, i) => i);
		expect(pageOf(rows, 1).rows).toHaveLength(20);
		expect(pageOf(rows, 3)).toMatchObject({ page: 3, pages: 3 });
		expect(pageOf(rows, 3).rows).toHaveLength(5);
		expect(pageOf(rows, 99).page).toBe(3);
		expect(pageOf(rows, -4).page).toBe(1);
		expect(pageOf([], 1)).toEqual({ rows: [], page: 1, pages: 1 });
	});

	it('names the begrip a hit was found by', () => {
		expect(conceptOf({ concept: 'wanprestatie' } as Hit)).toBe('wanprestatie');
		expect(conceptOf({ concept: null } as Hit)).toBe('');
	});

	it('offers the longer words of a query alone, at most three', () => {
		expect(narrowerWords('huur')).toEqual([]);
		expect(narrowerWords('opzegtermijn huurcontract wat is mijn')).toEqual([
			'opzegtermijn',
			'huurcontract',
			'mijn'
		]);
	});

	it('writes the address of a search with its period', () => {
		expect(resultsHref('stikstof motie')).toBe('/zoeken?q=stikstof+motie');
		expect(resultsHref('x', '2020-01-01', '2020-12-31')).toBe(
			'/zoeken?q=x&van=2020-01-01&tot=2020-12-31'
		);
	});
});
