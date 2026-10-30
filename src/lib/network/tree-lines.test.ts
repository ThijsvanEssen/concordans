import { describe, expect, it } from 'vitest';
import { crossings } from '$lib/graph/lane-lines';
import { sample } from '$lib/test/paths';
import { easePath, treeLines, type Box, type Pt, type TreeNode } from './tree-lines';

// A small keten: a person on top, layers of 104 px, rails 14,5 above each layer.
const rails = [33.5, 137.5, 241.5, 345.5];
const node = (x: number, row: number): TreeNode => ({
	x,
	row,
	top: 48 + row * 104 + 34 - 12,
	bottom: 48 + row * 104 + 34 + 31
});
const boxOf = (id: string, n: TreeNode): Box => ({
	id,
	x0: n.x - 40,
	x1: n.x + 40,
	y0: n.top + 10,
	y1: n.bottom
});
const nodes = new Map<string, TreeNode>([
	['p', node(500, 0)],
	['f1', node(300, 1)],
	['f2', node(700, 1)],
	['c1', node(200, 2)],
	['c2', node(500, 2)],
	['c3', node(800, 2)],
	['k1', node(400, 3)],
	['k2', node(600, 3)]
]);
const edge = (parent: string, child: string, kind = 'a') => ({
	id: `${parent}~${child}`,
	parent,
	child,
	kind
});
const edges = [
	edge('p', 'f1'),
	edge('p', 'f2'),
	edge('p', 'c1'),
	edge('p', 'c2'),
	edge('p', 'c3'),
	edge('p', 'k1'),
	edge('p', 'k2')
];
const boxes = [...nodes].map(([id, n]) => boxOf(id, n));
const lines = treeLines(nodes, edges, { rails, boxes });

const crosses = (a: Pt[], b: Pt[]) => crossings(a, b) > 0;

describe('treeLines', () => {
	it('draws every line as a bezier: no corner is a corner', () => {
		for (const l of lines) {
			expect(l.d).toMatch(/^M[\d. -]+(?:[LQC][\d. -]+)+$/);
			// Every bend of the skeleton is eased by a curve.
			const bends = l.points.length - 2;
			expect((l.d.match(/[QC]/g) ?? []).length).toBeGreaterThanOrEqual(bends > 0 ? 1 : 0);
		}
	});
	it('leaves each parent in one stem and each child from above', () => {
		for (const l of lines) {
			expect(l.points[0].x).toBe(l.tip.x);
			expect(l.points.at(-1)).toEqual(l.end);
			expect(l.points[1].x).toBe(l.tip.x);
		}
	});
	it('lets no line cross another of another parent, and no line run through a name', () => {
		const drawn = lines.map((l) => ({ l, pts: sample(l.d) }));
		for (const { l, pts } of drawn) {
			for (const b of boxes.filter((b) => b.id !== l.parent && b.id !== l.child))
				for (const q of pts)
					expect(
						q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1,
						`${l.id} through ${b.id}`
					).toBe(false);
		}
		for (let i = 0; i < drawn.length; i++)
			for (let j = i + 1; j < drawn.length; j++)
				if (drawn[i].l.parent !== drawn[j].l.parent)
					expect(crosses(drawn[i].pts, drawn[j].pts)).toBe(false);
	});
	it('keeps a line to a layer further down beside a name that stands in its way', () => {
		const blocked = new Map(nodes);
		blocked.set('f1', node(500, 1));
		const l = treeLines(blocked, [edge('p', 'c1')], {
			rails,
			boxes: [...blocked].map(([id, n]) => boxOf(id, n))
		})[0];
		expect(l.points.some((q) => q.x !== 500)).toBe(true);
		for (const q of sample(l.d))
			expect(q.x > 460 && q.x < 540 && q.y > 184 && q.y < 217).toBe(false);
	});
	it('puts the taks of one layer on levels of their own where they would overlap', () => {
		const two = new Map<string, TreeNode>([
			['a', node(300, 0)],
			['b', node(400, 0)],
			['x', node(250, 1)],
			['y', node(450, 1)]
		]);
		const out = treeLines(two, [edge('a', 'x'), edge('a', 'y'), edge('b', 'x'), edge('b', 'y')], {
			rails,
			boxes: []
		});
		const takY = (id: string) => out.find((l) => l.id === id)!.points.at(-2)!.y;
		expect(takY('a~x')).not.toBe(takY('b~x'));
	});
});

describe('treeLines, a line that skips a layer', () => {
	// Layer 1: a, s, b. Layer 2 under a and b: y far right, w under s's own column. s runs to
	// layer 3, past a's tak, which spans the whole width of layer 2.
	const tree = new Map<string, TreeNode>([
		['r', node(500, 0)],
		['a', node(300, 1)],
		['s', node(500, 1)],
		['b', node(700, 1)],
		['y', node(700, 2)],
		['w', node(500, 2)],
		['z', node(560, 3)]
	]);
	const all = [
		edge('r', 'a'),
		edge('r', 's'),
		edge('r', 'b'),
		edge('a', 'y'),
		edge('b', 'w'),
		edge('s', 'z')
	];
	const tall = [...tree].map(([id, n]) => boxOf(id, n));
	const drawn = treeLines(tree, all, { rails, boxes: tall });
	it('crosses the tak of another parent once, rather than run out and back across the layer', () => {
		const l = drawn.find((x) => x.id === 's~z')!;
		const xs = sample(l.d).map((q) => q.x);
		expect(Math.min(...xs)).toBeGreaterThan(400);
		expect(Math.max(...xs)).toBeLessThan(600);
	});
	it('still runs through no name', () => {
		for (const l of drawn)
			for (const b of tall.filter((b) => b.id !== l.parent && b.id !== l.child))
				for (const q of sample(l.d))
					expect(
						q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1,
						`${l.id} through ${b.id}`
					).toBe(false);
	});
});

describe('treeLines, a node with two parents', () => {
	it('takes the line from the left on the left, so they do not cross on arriving', () => {
		const two = new Map<string, TreeNode>([
			['top', node(500, 0)],
			['side', node(700, 1)],
			['kid', node(500, 2)]
		]);
		const out = treeLines(two, [edge('top', 'kid'), edge('side', 'kid')], { rails, boxes: [] });
		expect(crosses(sample(out[0].d), sample(out[1].d))).toBe(false);
	});
});

describe('easePath', () => {
	it('runs a short step sideways as one S, not as two small corners', () => {
		const d = easePath([
			{ x: 100, y: 0 },
			{ x: 100, y: 40 },
			{ x: 106, y: 40 },
			{ x: 106, y: 80 }
		]);
		expect(d).toContain('C');
		expect(d).not.toContain('Q');
	});
});
