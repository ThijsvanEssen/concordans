import { describe, expect, it } from 'vitest';
import {
	CLUSTER_MAX_LOOSE,
	clusterLabel,
	clustersOf,
	clusterZinnen,
	clusterHeading,
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
		// Its card no longer says they hang on the focus alone.
		expect(clusterZinnen(c)[0]).toBe('Met deze bron verbonden.');
	});

	it('makes no cluster without a focus', () => {
		const js = judgments(50);
		expect(clustersOf(nodes(50), citing(js), null, new Set(), new Set())).toEqual([]);
	});
});

describe('clusterZinnen', () => {
	const c = { members: Array.from({ length: 172 }, (_, i) => `j${i}`), neighbours: 174 };

	it('says what the count holds against the loose ones (art. 6:162)', () => {
		expect(clusterZinnen(c)).toEqual([
			'Alleen met deze bron verbonden.',
			'2 andere staan los: ook met een andere bron verbonden.'
		]);
	});

	it('says no more where none stands loose', () => {
		expect(clusterZinnen({ members: c.members, neighbours: 172 })).toEqual([
			'Alleen met deze bron verbonden.'
		]);
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
		expect(clusterZinnen(c, ['Art. 273f Sr', 'HR 24\u00a0november\u00a02015'])).toEqual([
			'Elk alleen verbonden met Art. 273f Sr en HR 24\u00a0november\u00a02015.'
		]);
	});
});
