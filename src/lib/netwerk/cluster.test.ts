import { describe, expect, it } from 'vitest';
import { CLUSTER_MAX_LOOSE, clusterLabel, clustersOf } from './cluster';

const focus = 'articles/a';
const judgments = (n: number) =>
	Array.from({ length: n }, (_, i) => ({
		id: `judgments/j${i}`,
		collection: 'judgments' as const
	}));
const citing = (ids: { id: string }[]) =>
	ids.map((j) => ({ source: j.id, target: focus, relation: 'REFERS_TO' }));

describe('clustersOf', () => {
	const nodes = (n: number) => [{ id: focus, collection: 'articles' as const }, ...judgments(n)];

	it('folds more than forty bronnen of one kind into one cluster', () => {
		const js = judgments(CLUSTER_MAX_LOOSE + 1);
		const [c, ...rest] = clustersOf(nodes(js.length), citing(js), focus, new Set(), new Set());
		expect(rest).toEqual([]);
		expect(c.id).toBe('cluster:judgments');
		expect(c.members).toHaveLength(41);
		expect(c).toMatchObject({ relation: 'REFERS_TO', toFocus: true });
		expect(clusterLabel(c)).toBe('41 uitspraken');
	});

	it('leaves forty as they are', () => {
		const js = judgments(CLUSTER_MAX_LOOSE);
		expect(clustersOf(nodes(js.length), citing(js), focus, new Set(), new Set())).toEqual([]);
	});

	it('keeps out a bron tied to something else, a kept bron, and an expanded kind', () => {
		const js = judgments(42);
		const edges = [
			...citing(js),
			{ source: js[0].id, target: 'documents/d', relation: 'REFERS_TO' },
			// Uitspraken that cite each other still hang on the focus alone.
			{ source: js[2].id, target: js[3].id, relation: 'REFERS_TO' }
		];
		const all = [...nodes(42), { id: 'documents/d', collection: 'documents' as const }];
		expect(clustersOf(all, edges, focus, new Set([js[1].id]), new Set())).toEqual([]);
		const more = judgments(44);
		const [c] = clustersOf(nodes(44), [...citing(more), ...edges], focus, new Set(), new Set());
		expect(c.members).not.toContain(js[0].id);
		expect(c.members).toContain(js[2].id);
		expect(
			clustersOf(nodes(44), citing(more), focus, new Set(), new Set(['cluster:judgments']))
		).toEqual([]);
	});

	it('makes no cluster without a focus', () => {
		const js = judgments(50);
		expect(clustersOf(nodes(50), citing(js), null, new Set(), new Set())).toEqual([]);
	});
});
