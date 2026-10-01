import { describe, expect, it } from 'vitest';
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import type { GraphNode } from '$lib/graph/types';
import { bronNaam } from './naam';

const awb: InstrumentMeta = {
	bwbId: 'BWBR0005537',
	title: 'Algemene wet bestuursrecht',
	shortTitle: 'Awb',
	citationTitle: 'Algemene wet bestuursrecht'
};
const meta = new Map([[awb.bwbId, awb]]);

const node = (n: Partial<GraphNode> & Pick<GraphNode, 'collection' | 'kind'>): GraphNode =>
	({ id: `${n.collection}/x`, key: 'x', label: 'x', ...n }) as GraphNode;

describe('bronNaam', () => {
	it('names an article with the short title of its law', () => {
		const art = node({
			collection: 'articles',
			kind: 'article',
			label: 'Art. 3:4',
			raw: { props: { bwb_id: 'BWBR0005537' } } as unknown as GraphNode['raw']
		});
		expect(bronNaam(art, meta)).toBe('Art. 3:4 Awb');
	});

	it('keeps an article without a known law as it is', () => {
		const art = node({ collection: 'articles', kind: 'article', label: 'Art. 1' });
		expect(bronNaam(art, meta)).toBe('Art. 1');
	});

	it('names a law by its short title', () => {
		const law = node({
			collection: 'instruments',
			kind: 'instrument',
			label: 'BWBR0005537',
			raw: { props: { bwb_id: 'BWBR0005537' } } as unknown as GraphNode['raw']
		});
		expect(bronNaam(law, meta)).toBe('Awb');
	});

	it('names a judgment as Verbonden does: court and date', () => {
		const j = node({
			collection: 'judgments',
			kind: 'judgment',
			label: 'RvS 2023/93',
			raw: {
				props: { court: 'Raad van State', date: '2023-01-11', ecli: 'ECLI:NL:RVS:2023:93' }
			} as unknown as GraphNode['raw']
		});
		expect(bronNaam(j, meta)).toBe('Raad van State, 11 januari 2023');
	});
});
