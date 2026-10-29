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
