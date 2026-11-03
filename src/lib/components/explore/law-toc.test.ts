import { describe, expect, it } from 'vitest';
import type { LawArticle } from '$lib/bron/law-articles';
import { filterGroups, filterItems, type TocGroup } from './law-toc';

const article = (articleNumber: string): LawArticle => ({
	articleNumber,
	label: `Artikel ${articleNumber}`,
	key: `k_${articleNumber}`,
	breadcrumb: []
});
const group = (label: string, title: string | null, over: Partial<TocGroup> = {}): TocGroup => ({
	id: label,
	label,
	title,
	type: 'hoofdstuk',
	items: [],
	children: [],
	...over
});
const tree = [
	group('Hoofdstuk 7', 'Bezwaar', {
		children: [
			group('Afdeling 7.1', 'Bezwaarschrift', { items: [article('7:1'), article('7:1a')] })
		]
	}),
	group('Hoofdstuk 8', 'Beroep', { items: [article('8:72')] })
];

describe('filterItems', () => {
	it('finds an article by its number, whatever the case', () => {
		expect(filterItems([article('7:1a'), article('8:1')], '7:1A').map((a) => a.key)).toEqual([
			'k_7:1a'
		]);
	});
});

describe('filterGroups', () => {
	it('keeps a division that holds the word whole', () => {
		const [g] = filterGroups(tree, 'bezwaarschrift');
		expect(g.children[0].items).toHaveLength(2);
	});

	it('keeps of another division only the path to what holds it', () => {
		const left = filterGroups(tree, '7:1a');
		expect(left.map((g) => g.label)).toEqual(['Hoofdstuk 7']);
		expect(left[0].children[0].items.map((a) => a.articleNumber)).toEqual(['7:1a']);
	});

	it('leaves nothing where nothing holds it', () => {
		expect(filterGroups(tree, 'klacht')).toEqual([]);
	});
});
