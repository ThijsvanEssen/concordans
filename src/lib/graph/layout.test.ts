import Graph from 'graphology';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { forEachRealNeighbor, radialLayout, realDegree } from './layout';

const at = (g: Graph, id: string) => ({
	x: g.getNodeAttribute(id, 'x') as number,
	y: g.getNodeAttribute(id, 'y') as number
});
/** The angle clockwise from the top, where the first sector begins. */
const angle = (g: Graph, id: string) =>
	(Math.atan2(at(g, id).y, at(g, id).x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);

describe('radialLayout', () => {
	function canvas(ids: string[]): Graph {
		const g = new Graph();
		for (const id of ids) g.addNode(id, { x: Math.random(), y: Math.random() });
		return g;
	}
	const kind = (id: string) => id.split('/')[0];

	it('puts one chosen bron at the centre, the rest in a sector per kind, in order', () => {
		const g = canvas(['a/focus', 'u/1', 'u/2', 'u/3', 's/1', 's/2']);
		radialLayout(g, ['a/focus'], kind, ['u', 's'], (a, b) => a.localeCompare(b));
		expect(at(g, 'a/focus')).toEqual({ x: 0, y: 0 });
		const r = (id: string) => Math.hypot(at(g, id).x, at(g, id).y);
		expect(r('u/1')).toBeCloseTo(r('s/2'));
		// The judgments' sector first, clockwise from the top; the stukken after it.
		const u = ['u/1', 'u/2', 'u/3'].map((id) => angle(g, id));
		expect(u).toEqual([...u].sort((a, b) => a - b));
		expect(Math.min(...['s/1', 's/2'].map((id) => angle(g, id)))).toBeGreaterThan(Math.max(...u));
	});

	it('sets more chosen bronnen side by side in the middle', () => {
		const g = canvas(['a/1', 'a/2', 'u/1']);
		radialLayout(g, ['a/1', 'a/2'], kind, ['u'], () => 0);
		expect(at(g, 'a/1').y).toBe(0);
		expect(at(g, 'a/2').y).toBe(0);
		expect(at(g, 'a/1').x).toBeLessThan(at(g, 'a/2').x);
	});

	it('sends a full ring on to the next one out', () => {
		const ids = Array.from({ length: 80 }, (_, i) => `u/${String(i).padStart(2, '0')}`);
		const g = canvas(['a/f', ...ids]);
		radialLayout(g, ['a/f'], kind, ['u'], (a, b) => a.localeCompare(b));
		const radii = new Set(ids.map((id) => Math.round(Math.hypot(at(g, id).x, at(g, id).y))));
		expect(radii.size).toBeGreaterThan(1);
	});
});

describe('radialLayout: hulls (Netwerkcanvas, Omhulling)', () => {
	const g = () => {
		const graph = new Graph();
		for (const id of ['c/1', 'c/2', 'w/1', 'w/2', 'w/3', 'u/1'])
			graph.addNode(id, { x: 0, y: 0, anchor: false });
		return graph;
	};
	const hullOf = (id: string) => (id.startsWith('w/') ? 'W' : null);
	const holds = (h: string, id: string) => h === 'W' && id.startsWith('w/');
	const kind = (id: string) => id.split('/')[0];
	const cmp = (a: string, b: string) => a.localeCompare(b);
	const apart = (graph: Graph, a: string, b: string) =>
		Math.hypot(at(graph, a).x - at(graph, b).x, at(graph, a).y - at(graph, b).y);

	it('stands the members of one hull together, as one place on the ring', () => {
		const graph = g();
		radialLayout(graph, ['c/1'], kind, ['w', 'u'], cmp, hullOf, holds);
		for (const [a, b] of [
			['w/1', 'w/2'],
			['w/2', 'w/3'],
			['w/1', 'w/3']
		])
			expect(apart(graph, a, b)).toBeLessThan(120);
		expect(apart(graph, 'w/1', 'u/1')).toBeGreaterThan(120);
	});

	it('stands the other members round a chosen member, beginning at the bottom', () => {
		const graph = g();
		radialLayout(graph, ['w/1'], kind, ['w', 'u'], cmp, hullOf, holds);
		const centre = at(graph, 'w/1');
		for (const id of ['w/2', 'w/3'])
			expect(Math.hypot(at(graph, id).x - centre.x, at(graph, id).y - centre.y)).toBeCloseTo(76);
		// The first satellite stands straight below, in sigma's y: the top is the pill's.
		expect(at(graph, 'w/2').x).toBeCloseTo(centre.x);
		expect(at(graph, 'w/2').y).toBeLessThan(centre.y);
	});

	it('sets more than three chosen bronnen in two rows, so no disc stands on a name', () => {
		const graph = new Graph();
		const ids = ['a/1', 'a/2', 'a/3', 'a/4', 'a/5', 'a/6'];
		for (const id of ids) graph.addNode(id, { x: 0, y: 0 });
		radialLayout(graph, ids, kind, ['a'], cmp);
		expect(new Set(ids.map((id) => Math.sign(at(graph, id).y))).size).toBe(2);
		for (let i = 1; i < ids.length; i++)
			expect(apart(graph, ids[i - 1], ids[i])).toBeGreaterThan(100);
	});
});

describe('forEachRealNeighbor and realDegree', () => {
	it('pass over a link that is no line', () => {
		const g = new Graph();
		for (const id of ['a', 'b', 'f']) g.addNode(id);
		g.addDirectedEdge('f', 'a');
		g.addUndirectedEdge('a', 'b', { layoutOnly: true });
		const of = (id: string) => {
			const found: string[] = [];
			forEachRealNeighbor(g, id, (n) => found.push(n));
			return found;
		};
		expect(of('a')).toEqual(['f']);
		expect(realDegree(g, 'b')).toBe(0);
	});

	it('are what the canvas reads: no bare neighbours or degree in GraphCanvas', () => {
		const src = readFileSync('src/lib/components/graph/GraphCanvas.svelte', 'utf8');
		expect(src).not.toMatch(/graph\.(forEachNeighbor|degree)\(/);
	});
});
