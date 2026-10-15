import { describe, expect, it } from 'vitest';
import {
	besideJudgment,
	depthFor,
	explicitDepth,
	filterQuery,
	indexCategory,
	nameOfPad,
	netwerkQuery
} from './explore-url';

const q = (query: string) => new URLSearchParams(query);

describe('the depth', () => {
	it.each([
		['', null],
		['diepte=1', 1],
		['diepte=3', 3],
		['diepte=9', 3],
		['diepte=-2', 1],
		['diepte=0', 2],
		['diepte=x', 2]
	])('?%s gives %s', (query, depth) => {
		expect(explicitDepth(q(query))).toBe(depth);
	});

	it('is one step around a group, two around any other bron, unless the address says', () => {
		const unset = { explicit: null, all: false };
		expect(depthFor('faction', unset)).toBe(1);
		expect(depthFor('dossier', unset)).toBe(1);
		expect(depthFor('article', unset)).toBe(2);
		expect(depthFor('faction', { explicit: 3, all: false })).toBe(3);
		expect(depthFor('article', { explicit: 3, all: true })).toBe(1);
	});
});

describe('the params of a part of the state', () => {
	it('keeps the netwerk to its own three params', () => {
		expect(netwerkQuery(q('focus=a/b&netwerk=members/m1,members/m2&tussen=0&lid=2'))).toBe(
			'netwerk=members%2Fm1%2Cmembers%2Fm2&tussen=0'
		);
		expect(netwerkQuery(q('focus=a/b'))).toBe('');
	});

	it('gives the bronfilter one string, whatever else changes', () => {
		const a = filterQuery(q('focus=a/b&lid=2&jaar=2020&naast=documents/x'));
		const b = filterQuery(q('jaar=2020&versies=1&lid=2'));
		expect(a).toBe(b);
		expect(new URLSearchParams(a).get('lid')).toBe('2');
		expect(filterQuery(q('focus=a/b'))).toBe('');
	});

	it('lists the dossiers in Bladeren unless ?kind names another list', () => {
		expect(indexCategory(q(''))).toBe('dossiers');
		expect(indexCategory(q('kind=judgments'))).toBe('judgments');
		expect(indexCategory(q('kind=onzin'))).toBe('dossiers');
	});
});

describe('besideJudgment', () => {
	it('builds the judgment beside the article from its key, and nothing else', () => {
		const node = besideJudgment({ collection: 'judgments', key: 'ecli_nl_hr_2019_2006' });
		expect(node?.id).toBe('judgments/ecli_nl_hr_2019_2006');
		expect(node?.label).toBe('ECLI:NL:HR:2019:2006');
		expect(besideJudgment({ collection: 'documents', key: 'kst-1' })).toBeNull();
		expect(besideJudgment(null)).toBeNull();
	});
});

describe('nameOfPad', () => {
	it('names what a readable address names', () => {
		expect(nameOfPad({ soort: 'artikel', wet: 'BWBR0005537', nummer: '3:4' })).toBe(
			'Artikel 3:4 van BWBR0005537'
		);
		expect(nameOfPad({ soort: 'publicatie', reeks: 'stb', jaar: '2026', nummer: '94' })).toBe(
			'Stb. 2026, 94'
		);
		expect(nameOfPad({ soort: 'lid', slug: 'rob-jetten' })).toBe('Lid rob-jetten');
	});
});
