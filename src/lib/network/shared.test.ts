import { describe, expect, it } from 'vitest';
import { sharedFromNetwork, sharedModel, sentence } from './shared';
import type { GraphEdge, GraphNode } from '$lib/graph/types';

const names = (id: string) =>
	({
		'articles/a': { name: 'Art. 6:162 BW', collection: 'articles' as const },
		'articles/b': { name: 'Art. 7:658 BW', collection: 'articles' as const }
	})[id] ?? { name: id, collection: null };

const neighbour = (
	id: string,
	collection: string,
	links: { source: string; direction: string; relation: string }[]
) => ({
	id,
	key: id.split('/')[1],
	collection,
	type: collection,
	display_name: id,
	labels: [],
	props: {},
	links: links.map((l) => ({ ...l, edge_id: `${l.source}-${id}`, status: null, confidence: null }))
});

describe('the weergave Verband', () => {
	it('says a verbinding of its object, a preposition kept with its verb', () => {
		expect(sentence('haalt aan', 'Art. 6:162 BW', 'naar')).toBe('Haalt Art. 6:162 BW aan');
		expect(sentence('verwijst naar', 'Art. 6:162 BW', 'naar')).toBe('Verwijst naar Art. 6:162 BW');
		expect(sentence('noemt', 'Art. 6:162 BW', 'van')).toBe('Art. 6:162 BW noemt deze bron');
	});

	it('draws the shared bronnen as rows, counts the judgments, joins the lines of one verb', () => {
		const shared = {
			ids: ['articles/a', 'articles/b'],
			total: 120,
			buckets: [
				{
					collection: 'documents',
					type: 'document',
					total: 2,
					next_offset: null,
					items: [
						neighbour('documents/k', 'documents', [
							{ source: 'articles/a', direction: 'inbound', relation: 'REFERS_TO' },
							{ source: 'articles/b', direction: 'inbound', relation: 'REFERS_TO' }
						])
					]
				},
				{ collection: 'judgments', type: 'judgment', total: 118, next_offset: 30, items: [] }
			],
			facets: { collection: [], tier: [], subject_area: [] }
		} as never;
		const m = sharedModel(shared, names);
		expect(m.judgments).toBe(118);
		expect(m.rows.map((r) => r.id)).toEqual(['documents/k']);
		expect(m.rows[0].at).toEqual(['articles/a', 'articles/b']);
		expect(m.rows[0].line).toMatch(/Art\. 6:162 BW en Art\. 7:658 BW/);
		expect(m.rest).toBe(1);
	});

	it('reads the bronnen between from the netwerk where the API has none, those tied to both first', () => {
		const node = (id: string) =>
			({
				id,
				key: id.split('/')[1],
				collection: id.split('/')[0],
				label: id,
				drawClass: 'document'
			}) as GraphNode;
		const edge = (source: string, target: string): GraphEdge => ({
			id: `${source}>${target}`,
			source,
			target,
			relation: 'REFERS_TO',
			label: '',
			directed: true
		});
		const shared = sharedFromNetwork(
			['articles/a', 'articles/b'],
			['articles/a', 'articles/b', 'documents/x', 'documents/y', 'documents/z'],
			node,
			[
				edge('documents/x', 'articles/a'),
				edge('documents/y', 'articles/a'),
				edge('documents/y', 'articles/b')
			]
		);
		const m = sharedModel(shared, names);
		expect(m.rows.map((r) => r.id)).toEqual(['documents/y', 'documents/x']);
	});
});
