import { describe, expect, it } from 'vitest';
import { nodeToGraphNode, type BaseNode } from '$lib/graph/types';
import { tableTitle } from './table-title';

const node = (n: Partial<BaseNode> & Pick<BaseNode, 'collection' | 'key'>) =>
	nodeToGraphNode({ display_name: null, props: {}, ...n } as BaseNode)!;

describe('tableTitle', () => {
	it('names a judgment as it is cited elsewhere, not by its display name (B5)', () => {
		const urgenda = node({
			collection: 'judgments',
			key: 'ECLI_NL_HR_2019_2006',
			display_name: 'Hoge Raad 2019-12-20 / 19/00135',
			props: {
				ecli: 'ECLI:NL:HR:2019:2006',
				court: 'Hoge Raad',
				date: '2019-12-20',
				names: ['Urgenda']
			},
			cite: { short: 'HR 20\u00a0december\u00a02019' } as BaseNode['cite']
		});
		expect(tableTitle(urgenda)).toBe('Verbindingen van HR 20\u00a0december\u00a02019 (Urgenda)');
	});

	it('keeps an article by its display name, lower case', () => {
		const art = node({ collection: 'articles', key: 'a', display_name: 'Artikel 6:162 BW' });
		expect(tableTitle(art)).toBe('Verbindingen van artikel 6:162 BW');
	});
});
