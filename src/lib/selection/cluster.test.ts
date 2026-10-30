import { describe, expect, it } from 'vitest';
import {
	CLUSTER_MAX_LOOSE,
	clusterLabel,
	looseMaxFor,
	clustersOf,
	clusterBinding,
	clusterHeading,
	edgesToClusters,
	TUSSEN_MAX_LOOSE,
	tussenClustersOf
} from './cluster';

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

	it('folds uitspraken that also cite an article beside the focus (BH2815, N4)', () => {
		// 137 uitspraken cite HR BH2815 and most of them an article the focus cites too.
		const js = judgments(137);
		const art = { id: 'articles/6_162', collection: 'articles' as const };
		const edges = [
			...citing(js),
			{ source: focus, target: art.id, relation: 'REFERS_TO' },
			...js.slice(0, 126).map((j) => ({ source: j.id, target: art.id, relation: 'REFERS_TO' }))
		];
		const [c, ...rest] = clustersOf([...nodes(137), art], edges, focus, new Set(), new Set());
		expect(rest).toEqual([]);
		expect(clusterLabel(c)).toBe('137 uitspraken');
		expect(c.alsoTied).toBe(true);
		expect(clusterBinding(c)).toBeNull();
	});

	it('makes no cluster without a focus', () => {
		const js = judgments(50);
		expect(clustersOf(nodes(50), citing(js), null, new Set(), new Set())).toEqual([]);
	});
});

describe('clusterBinding', () => {
	it('says no more than a label, and only for a cluster between several bronnen', () => {
		expect(clusterBinding({})).toBeNull();
		expect(clusterBinding({ ends: [] }, ['Gemw', 'BW6'])).toBe('Verbonden met Gemw en BW6');
		expect(clusterBinding({ ends: [] })).toBe('Verbonden met dezelfde bronnen');
	});
});

describe('clusterHeading', () => {
	const c = { collection: 'decisions' as const, members: Array.from({ length: 200 }, String) };

	it('names the whole where there are more than it holds (N2: VVD)', () => {
		expect(clusterHeading(c, 63600)).toBe('200 van 63.600 stemmingen');
	});

	it('is its label where it holds them all', () => {
		expect(clusterHeading(c, 200)).toBe(clusterLabel(c));
		expect(clusterHeading(c, null)).toBe(clusterLabel(c));
	});
	it("names the whole a cluster stands for: a commissie's 607 other dossiers (B41)", () => {
		const other = { collection: 'dossiers' as const, members: ['d1', 'd2'], total: 607 };
		expect(clusterLabel(other)).toBe('607 dossiers');
		expect(clusterHeading(other, null)).toBe('2 van 607 dossiers');
	});
});

describe('tussenClustersOf', () => {
	// HR 2015 and art. 273f Sr chosen; uitspraken that cite both, one that also cites a third.
	const hr = 'judgments/hr2015';
	const art = 'articles/273f';
	const chosen = new Set([hr, art]);
	const many = Array.from({ length: TUSSEN_MAX_LOOSE + 2 }, (_, i) => `judgments/u${i}`);
	const nodes = [hr, art, 'documents/x', ...many].map((id) => ({
		id,
		collection: id.split('/')[0] as 'judgments'
	}));
	const edges = [
		...many.flatMap((id) => [
			{ source: id, target: hr, relation: 'REFERS_TO' },
			{ source: id, target: art, relation: 'REFERS_TO' }
		]),
		{ source: many[0], target: 'documents/x', relation: 'REFERS_TO' }
	];

	it('folds the bronnen of a kind between the same chosen bronnen, with a line to each', () => {
		const [c] = tussenClustersOf(nodes, edges, chosen, new Set(), new Set());
		expect(c.members).toHaveLength(TUSSEN_MAX_LOOSE + 1);
		expect(c.members).not.toContain(many[0]);
		expect(c.ends?.map((e) => [e.id, e.relation, e.toEnd])).toEqual([
			[art, 'REFERS_TO', true],
			[hr, 'REFERS_TO', true]
		]);
		expect(clusterLabel(c)).toBe(`${TUSSEN_MAX_LOOSE + 1} uitspraken`);
	});

	it('leaves few alone, and a cluster shown in full', () => {
		const few = edges.slice(0, 2 * TUSSEN_MAX_LOOSE);
		expect(tussenClustersOf(nodes, few, chosen, new Set(), new Set())).toEqual([]);
		const [c] = tussenClustersOf(nodes, edges, chosen, new Set(), new Set());
		expect(tussenClustersOf(nodes, edges, chosen, new Set(), new Set([c.id]))).toEqual([]);
	});

	it('names the chosen bronnen on its card', () => {
		const [c] = tussenClustersOf(nodes, edges, chosen, new Set(), new Set());
		expect(clusterBinding(c, ['Art. 273f Sr', 'HR 24\u00a0november\u00a02015'])).toBe(
			'Verbonden met Art. 273f Sr en HR 24\u00a0november\u00a02015'
		);
	});
});

describe('edgesToClusters', () => {
	const cl = { id: 'cluster:articles@cbw', members: ['articles/a1', 'articles/a2'] };
	const e = (source: string, target: string, relation = 'BASED_ON') => ({
		id: `${source}>${target}`,
		source,
		target,
		relation
	});

	it('leads a line to a bron in a cluster to the cluster, once', () => {
		const out = edgesToClusters(
			[e('instruments/cbb', 'articles/a1'), e('instruments/cbb', 'articles/a2'), e('x', 'y')],
			[cl]
		);
		expect(out).toEqual([
			{
				id: 'via:instruments/cbb~cluster:articles@cbw',
				source: 'instruments/cbb',
				target: cl.id,
				relation: 'BASED_ON'
			}
		]);
	});

	it('drops a line inside the cluster and one to the bron it hangs on', () => {
		const out = edgesToClusters(
			[e('articles/a1', 'articles/a2'), e('articles/a1', 'instruments/cbw', 'PART_OF')],
			[cl],
			new Map([[cl.id, ['instruments/cbw']]])
		);
		expect(out).toEqual([]);
	});
});

describe('looseMaxFor', () => {
	it('folds earlier with more steps and more bronnen, never under ten', () => {
		expect(looseMaxFor(1, 1)).toBe(CLUSTER_MAX_LOOSE);
		expect(looseMaxFor(2, 2)).toBe(20);
		expect(looseMaxFor(3, 1)).toBe(20);
		expect(looseMaxFor(3, 2)).toBe(13);
		expect(looseMaxFor(50, 3)).toBeGreaterThanOrEqual(10);
	});
	it('clustersOf folds at the given maximum', () => {
		const js = judgments(21);
		const all = [{ id: focus, collection: 'articles' as const }, ...js];
		expect(clustersOf(all, citing(js), focus, new Set(), new Set())).toEqual([]);
		expect(clustersOf(all, citing(js), focus, new Set(), new Set(), '', 20)).toHaveLength(1);
	});
});
