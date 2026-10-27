import { describe, expect, it } from 'vitest';
import { easePath, stamboom, type Box, type Pt, type StamNode } from './stamboom';

// A small keten: a person on top, layers of 104 px, rails 14,5 above each layer.
const rails = [33.5, 137.5, 241.5, 345.5];
const node = (x: number, row: number): StamNode => ({
	x,
	row,
	top: 48 + row * 104 + 34 - 12,
	bottom: 48 + row * 104 + 34 + 31
});
const boxOf = (id: string, n: StamNode): Box => ({
	id,
	x0: n.x - 40,
	x1: n.x + 40,
	y0: n.top + 10,
	y1: n.bottom
});
const nodes = new Map<string, StamNode>([
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
const lines = stamboom(nodes, edges, { rails, boxes });

/** Points along a path of M, L, Q and C commands, 2 px apart at most. */
function sample(d: string): Pt[] {
	const t = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g) ?? [];
	const out: Pt[] = [];
	let cur: Pt = { x: 0, y: 0 };
	for (let i = 0; i < t.length; ) {
		const c = t[i++];
		const n = c === 'Q' ? 4 : c === 'C' ? 6 : 2;
		const v = t.slice(i, i + n).map(Number);
		i += n;
		const end = { x: v[n - 2], y: v[n - 1] };
		if (c === 'M') out.push(end);
		else {
			const steps = Math.max(2, Math.ceil(Math.hypot(end.x - cur.x, end.y - cur.y) / 2));
			for (let s = 1; s <= steps; s++) {
				const u = s / steps;
				const a = 1 - u;
				if (c === 'L') out.push({ x: cur.x + (end.x - cur.x) * u, y: cur.y + (end.y - cur.y) * u });
				else if (c === 'Q')
					out.push({
						x: a * a * cur.x + 2 * a * u * v[0] + u * u * end.x,
						y: a * a * cur.y + 2 * a * u * v[1] + u * u * end.y
					});
				else
					out.push({
						x: a ** 3 * cur.x + 3 * a * a * u * v[0] + 3 * a * u * u * v[2] + u ** 3 * end.x,
						y: a ** 3 * cur.y + 3 * a * a * u * v[1] + 3 * a * u * u * v[3] + u ** 3 * end.y
					});
			}
		}
		cur = end;
	}
	return out;
}

const crosses = (a: Pt[], b: Pt[]) => {
	const ccw = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
	for (let i = 1; i < a.length; i++)
		for (let j = 1; j < b.length; j++) {
			const d1 = ccw(a[i - 1], a[i], b[j - 1]);
			const d2 = ccw(a[i - 1], a[i], b[j]);
			const d3 = ccw(b[j - 1], b[j], a[i - 1]);
			const d4 = ccw(b[j - 1], b[j], a[i]);
			if (d1 * d2 < -1e-6 && d3 * d4 < -1e-6) return true;
		}
	return false;
};

describe('stamboom', () => {
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
		const l = stamboom(blocked, [edge('p', 'c1')], {
			rails,
			boxes: [...blocked].map(([id, n]) => boxOf(id, n))
		})[0];
		expect(l.points.some((q) => q.x !== 500)).toBe(true);
		for (const q of sample(l.d))
			expect(q.x > 460 && q.x < 540 && q.y > 184 && q.y < 217).toBe(false);
	});
	it('puts the taks of one layer on levels of their own where they would overlap', () => {
		const two = new Map<string, StamNode>([
			['a', node(300, 0)],
			['b', node(400, 0)],
			['x', node(250, 1)],
			['y', node(450, 1)]
		]);
		const out = stamboom(two, [edge('a', 'x'), edge('a', 'y'), edge('b', 'x'), edge('b', 'y')], {
			rails,
			boxes: []
		});
		const takY = (id: string) => out.find((l) => l.id === id)!.points.at(-2)!.y;
		expect(takY('a~x')).not.toBe(takY('b~x'));
	});
});

describe('stamboom, a node with two parents', () => {
	it('takes the line from the left on the left, so they do not cross on arriving', () => {
		const two = new Map<string, StamNode>([
			['top', node(500, 0)],
			['side', node(700, 1)],
			['kid', node(500, 2)]
		]);
		const out = stamboom(two, [edge('top', 'kid'), edge('side', 'kid')], { rails, boxes: [] });
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
