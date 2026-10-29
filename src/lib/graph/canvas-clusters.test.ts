import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUSTER_MAX_LOOSE } from '$lib/selection/cluster';
import { canvasClusters, type ClusterInput } from './canvas-clusters';
import type { GraphNode } from './types';

const node = (collection: string, key: string) =>
	({ id: `${collection}/${key}`, collection, key, drawClass: 'judgment' }) as unknown as GraphNode;

describe('canvasClusters', () => {
	const focus = node('articles', 'a');
	const js = Array.from({ length: CLUSTER_MAX_LOOSE + 5 }, (_, i) => node('judgments', `j${i}`));
	const input: ClusterInput = {
		nodes: [focus, ...js],
		edges: js.map((j) => ({ source: j.id, target: focus.id, relation: 'REFERS_TO' })),
		focus: focus.id,
		pinned: new Set(),
		core: null,
		surroundings: false,
		looseMax: CLUSTER_MAX_LOOSE,
		groups: new Map(),
		nodeOf: () => undefined
	};

	it('folds the loose neighbours past forty, and an open one is not folded', () => {
		expect(canvasClusters(input, new Set()).map((c) => c.members.length)).toEqual([45]);
		expect(canvasClusters(input, new Set(['cluster:judgments']))).toEqual([]);
	});

	it('is the one rule: the canvas does not fold with a rule of its own', () => {
		const view = readFileSync('src/lib/components/graph/GraphView.svelte', 'utf8');
		expect(view).not.toMatch(/\b(clustersOf|tussenClustersOf)\(/);
		const store = readFileSync('src/lib/graph/store/context.ts', 'utf8');
		expect(store).not.toMatch(/\b(clustersOf|tussenClustersOf)\(/);
	});
});

describe('the dossiers a commissie leads (B41)', () => {
	const jv = node('committees', 'jv');
	const dossiers = Array.from({ length: 15 }, (_, i) => node('dossiers', `d${i}`));
	const led = (meta: (i: number) => Record<string, unknown>) =>
		({
			nodes: [jv, ...dossiers],
			edges: dossiers.map((d, i) => ({
				source: d.id,
				target: jv.id,
				relation: 'LED_BY',
				meta: meta(i)
			})),
			focus: jv.id,
			pinned: new Set(),
			core: null,
			surroundings: false,
			looseMax: CLUSTER_MAX_LOOSE,
			groups: new Map(),
			nodeOf: () => undefined
		}) satisfies ClusterInput;

	it('keeps the twelve latest as a bron, the rest one cluster "overige"', () => {
		// d14 the latest, d0 the oldest; d3 undated.
		const input = led((i) => ({ latest: i === 3 ? null : `2026-01-${10 + i}`, activities: 1 }));
		const [cluster] = canvasClusters(input, new Set());
		expect(cluster.id).toBe('cluster:dossiers');
		expect(cluster.members).toEqual(['dossiers/d1', 'dossiers/d0', 'dossiers/d3']);
		expect(cluster.ends).toEqual([{ id: jv.id, relation: 'LED_BY', toEnd: true }]);
		expect(canvasClusters(input, new Set(['cluster:dossiers']))).toEqual([]);
	});

	it('stands for every dossier past the twelve, also those not loaded', () => {
		const input = { ...led(() => ({ activities: 1 })), ledTotal: 619 };
		expect(canvasClusters(input, new Set())[0].total).toBe(607);
	});

	it('orders by the activities where the API gives no day', () => {
		const [cluster] = canvasClusters(
			led((i) => ({ activities: i })),
			new Set()
		);
		expect(cluster.members).toEqual(['dossiers/d2', 'dossiers/d1', 'dossiers/d0']);
	});

	it('folds nothing around another kind of focus', () => {
		const input = { ...led(() => ({})), focus: dossiers[0].id };
		expect(canvasClusters(input, new Set()).some((c) => c.id === 'cluster:dossiers')).toBe(false);
	});
});
