import { describe, expect, it } from 'vitest';
import type { ChangedArticles } from '$lib/components/parliamentary/changed-articles';
import {
	changedFirst,
	changedNumbers,
	laneDossierNumber,
	numberedSquares,
	scrollToShow
} from './lane-changes';
import type { GraphNode } from './types';

const box = (left: number, top: number, right: number, bottom: number) => ({
	left,
	top,
	right,
	bottom
});

describe('laneDossierNumber', () => {
	it('takes the number its bronnen carry, else reads it from the key', () => {
		const stuk = { raw: { props: { dossier_number: '36600-VIII' } } } as unknown as GraphNode;
		expect(laneDossierNumber('dossiers/36600_viii', ['a'], () => stuk)).toBe('36600-VIII');
		expect(laneDossierNumber('dossiers/21501_02', [], () => undefined)).toBe('21501-02');
	});
});

describe('changedNumbers', () => {
	it('gives every changed article its number, once', () => {
		const change = (id: string, article_number: string) => ({ article: { id, article_number } });
		const data = {
			laws: [{ changes: [change('articles/a_14', '14'), change('articles/a_14', '14')] }]
		} as unknown as ChangedArticles;
		expect([...changedNumbers(data)]).toEqual([['articles/a_14', '14']]);
	});
});

describe('changedFirst', () => {
	it('puts the changed articles in front and keeps the rest in order', () => {
		expect(changedFirst(['a', 'b', 'c'], new Map([['c', '3']]))).toEqual(['c', 'a', 'b']);
		expect(changedFirst(['a', 'b'], new Map())).toEqual(['a', 'b']);
	});
});

describe('numberedSquares', () => {
	it('numbers a square only where the number before it has ended', () => {
		const changed = new Map([
			['a', '145f'],
			['b', '8'],
			['c', '9'],
			['d', '10']
		]);
		expect([...numberedSquares(['a', 'b', 'c', 'd'], changed, 10, 20)]).toEqual(['a', 'c', 'd']);
	});
	it('starts again on each line', () => {
		const changed = new Map([
			['a', '145f'],
			['b', '8']
		]);
		expect([...numberedSquares(['a', 'b'], changed, 1, 20)]).toEqual(['a', 'b']);
	});
	it('leaves what is not changed alone', () => {
		expect(numberedSquares(['a'], new Map(), 4, 20).size).toBe(0);
	});
});

describe('scrollToShow', () => {
	const field = box(0, 0, 1000, 700);
	it('stays where what is marked is in view', () => {
		expect(scrollToShow(box(100, 100, 200, 200), field, null)).toEqual({ x: 0, y: 0 });
	});
	it('scrolls it out from under a card at the right', () => {
		const card = box(660, 0, 1000, 700);
		expect(scrollToShow(box(800, 100, 900, 200), field, card)).toEqual({ x: 256, y: 0 });
	});
	it('scrolls it up from under a sheet at the foot', () => {
		const card = box(0, 400, 1000, 700);
		expect(scrollToShow(box(100, 500, 200, 600), field, card)).toEqual({ x: 0, y: 216 });
	});
	it('shows the start of what is too wide for what is left', () => {
		const card = box(660, 0, 1000, 700);
		expect(scrollToShow(box(300, 100, 1100, 200), field, card).x).toBe(284);
	});
});
