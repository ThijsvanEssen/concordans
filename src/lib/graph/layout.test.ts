import Graph from 'graphology';
import { describe, expect, it } from 'vitest';
import type { ContainerGroup } from './container-membership';
import { readFileSync } from 'node:fs';
import {
	forEachRealNeighbor,
	packGroups,
	placeClusters,
	realDegree,
	ringAround,
	syncGroupLinks
} from './layout';

const group = (id: string, members: string[]): ContainerGroup => ({
	kind: 'dossier',
	id,
	label: id,
	fullLabel: id,
	members: new Set(members),
	parts: new Set(members),
	periods: new Map()
});

/** A small fixed canvas: two dossiers of three stukken on top of each other, a judgment in
 *  them, a focus with three neighbours. */
function small(): Graph {
	const g = new Graph();
	const at: Record<string, [number, number]> = {
		a1: [0, 0],
		a2: [10, 0],
		a3: [0, 10],
		b1: [5, 5],
		b2: [15, 5],
		b3: [5, 15],
		j: [6, 6],
		f: [100, 100],
		c: [100, 110]
	};
	for (const [id, [x, y]] of Object.entries(at)) g.addNode(id, { x, y });
	g.addDirectedEdge('f', 'a1');
	g.addDirectedEdge('f', 'j');
	g.addDirectedEdge('c', 'f');
	return g;
}

const rounded = (g: Graph) =>
	Object.fromEntries(
		g.mapNodes((id, a) => [id, [Math.round(a.x as number), Math.round(a.y as number)]])
	);

const dist = (g: Graph, a: string, b: string) =>
	Math.hypot(
		(g.getNodeAttribute(a, 'x') as number) - (g.getNodeAttribute(b, 'x') as number),
		(g.getNodeAttribute(a, 'y') as number) - (g.getNodeAttribute(b, 'y') as number)
	);

describe('packGroups', () => {
	it('packs each group into its own disk, apart from the other', () => {
		const g = small();
		expect(packGroups(g, [group('A', ['a1', 'a2', 'a3']), group('B', ['b1', 'b2', 'b3'])])).toBe(
			true
		);
		expect(rounded(g)).toMatchInlineSnapshot(`
			{
			  "a1": [
			    -16,
			    -29,
			  ],
			  "a2": [
			    -45,
			    -14,
			  ],
			  "a3": [
			    -27,
			    -58,
			  ],
			  "b1": [
			    53,
			    41,
			  ],
			  "b2": [
			    24,
			    56,
			  ],
			  "b3": [
			    43,
			    12,
			  ],
			  "c": [
			    100,
			    110,
			  ],
			  "f": [
			    100,
			    100,
			  ],
			  "j": [
			    -7,
			    -7,
			  ],
			}
		`);
		// Members of one group stand closer to each other than to the other group.
		expect(dist(g, 'a1', 'a2')).toBeLessThan(dist(g, 'a1', 'b1'));
	});

	it('packs nothing for groups of one', () => {
		const g = small();
		expect(packGroups(g, [group('A', ['a1']), group('B', ['gone', 'b1'])])).toBe(false);
		expect(rounded(g)).toEqual(rounded(small()));
	});

	it('packs a bron in two groups by the larger one', () => {
		const g = small();
		packGroups(g, [group('A', ['a1', 'a2']), group('B', ['a1', 'b1', 'b2'])]);
		expect(dist(g, 'a1', 'b1')).toBeLessThan(dist(g, 'a1', 'a2'));
	});
});

describe('forEachRealNeighbor and realDegree', () => {
	it('pass over the links of a hull: a group of four without lines has no neighbours', () => {
		const g = small();
		syncGroupLinks(g, [group('A', ['a1', 'a2', 'a3', 'b1'])], new Set());
		const of = (id: string) => {
			const found: string[] = [];
			forEachRealNeighbor(g, id, (n) => found.push(n));
			return found;
		};
		expect(of('a2')).toEqual([]);
		expect(realDegree(g, 'a2')).toBe(0);
		expect(of('a1')).toEqual(['f']);
		expect(realDegree(g, 'f')).toBe(3);
	});

	it('are what the canvas reads: no bare neighbours or degree in GraphCanvas', () => {
		const src = readFileSync('src/lib/components/graph/GraphCanvas.svelte', 'utf8');
		expect(src).not.toMatch(/graph\.(forEachNeighbor|degree)\(/);
	});
});

describe('syncGroupLinks', () => {
	it('ties a group in a ring with chords past three, and takes out what no group needs', () => {
		const g = small();
		const four = syncGroupLinks(g, [group('A', ['a1', 'a2', 'a3', 'j'])], new Set());
		expect([...four].sort()).toEqual([
			'anchor:A:a1~a2',
			'anchor:A:a1~a3',
			'anchor:A:a1~j',
			'anchor:A:a2~a3',
			'anchor:A:a2~j',
			'anchor:A:a3~j'
		]);
		expect(g.getEdgeAttribute('anchor:A:a1~a2', 'layoutOnly')).toBe(true);
		const two = syncGroupLinks(g, [group('A', ['a1', 'a2'])], four);
		expect([...two]).toEqual(['anchor:A:a1~a2']);
		expect(g.edges().filter((e) => e.startsWith('anchor:'))).toEqual(['anchor:A:a1~a2']);
	});

	it('adds one link where two groups tie the same two bronnen', () => {
		const g = small();
		syncGroupLinks(g, [group('A', ['a1', 'a2']), group('B', ['a1', 'a2'])], new Set());
		expect(g.edges().filter((e) => e.startsWith('anchor:'))).toEqual(['anchor:A:a1~a2']);
	});
});

describe('placeClusters', () => {
	it('puts a cluster just outside the ring of the focus, where it has most room', () => {
		const g = small();
		g.addNode('cluster:judgments', { x: 0, y: 0 });
		g.addDirectedEdge('cluster:judgments', 'f');
		placeClusters(g, 'f', ['cluster:judgments'], (id) => id.startsWith('cluster:'));
		expect(rounded(g)['cluster:judgments']).toMatchInlineSnapshot(`
			[
			  222,
			  -22,
			]
		`);
	});
});

describe('ringAround', () => {
	it('puts the focus at the centre, its neighbours on a ring, the rest outside, the chosen where they are', () => {
		const g = small();
		const moved = ringAround(g, 'f', new Set(['b3']));
		expect([...moved].sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'c', 'j']);
		expect(rounded(g).f).toEqual([0, 0]);
		expect(dist(g, 'f', 'a1')).toBeCloseTo(120);
		expect(dist(g, 'f', 'a2')).toBeCloseTo(260);
		expect(rounded(g).b3).toEqual([5, 15]);
	});
});
