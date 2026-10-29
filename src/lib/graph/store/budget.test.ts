import { describe, expect, it } from 'vitest';
import { costOf, planTrim, shareOut, type BudgetInput } from './budget';

/** `n` articles `a<i>` (older first) tied to `to`, with the order they came in. */
const around = (to: string, prefix: string, n: number, from = 0) => {
	const ids = Array.from({ length: n }, (_, i) => `${prefix}${i}`);
	const edges = ids.map((id) => ({ source: id, target: to }));
	return { ids, edges, order: new Map(ids.map((id, i) => [id, from + i])) };
};

function scene(
	bronnen: { id: string; n: number }[],
	extra: Partial<BudgetInput> = {},
	cap = 400
): BudgetInput {
	let at = 0;
	const ids: string[] = [];
	const edges: { source: string; target: string }[] = [];
	const order = new Map<string, number>();
	for (const b of bronnen) {
		ids.push(b.id);
		order.set(b.id, at++);
		const a = around(b.id, `${b.id}/n`, b.n, at);
		at += b.n;
		ids.push(...a.ids);
		edges.push(...a.edges);
		a.order.forEach((v, k) => order.set(k, v));
	}
	return {
		ids,
		edges,
		order: (id) => order.get(id) ?? 0,
		cap,
		chosen: bronnen.map((b) => b.id),
		hullOf: () => undefined,
		core: null,
		protect: new Set(),
		clusters: [],
		...extra
	};
}

const left = (input: BudgetInput) => {
	const drop = new Set(planTrim(input));
	return input.ids.filter((id) => !drop.has(id));
};
const ownedBy = (ids: string[], bron: string) => ids.filter((id) => id.startsWith(`${bron}/n`));

describe('shareOut', () => {
	it('gives an equal share, and the rest of what one leaves unused to the others', () => {
		expect(shareOut([1000], 400)).toEqual([400]);
		expect(shareOut([1000, 1000], 400)).toEqual([200, 200]);
		expect(shareOut([1000, 1000, 1000], 400)).toEqual([133, 133, 134]);
		expect(shareOut([10, 1000, 1000], 400)).toEqual([10, 195, 195]);
	});
});

describe('planTrim', () => {
	it('drops nothing within the cap', () => {
		expect(planTrim(scene([{ id: 'a', n: 100 }]))).toEqual([]);
	});

	it('one bron keeps the newest up to the cap', () => {
		const input = scene([{ id: 'a', n: 600 }]);
		const kept = left(input);
		expect(kept).toHaveLength(400);
		expect(kept).toContain('a');
		expect(kept).toContain('a/n599');
		expect(kept).not.toContain('a/n0');
	});

	it('two bronnen share evenly, the older one keeps its part', () => {
		const kept = left(
			scene([
				{ id: 'a', n: 500 },
				{ id: 'b', n: 500 }
			])
		);
		expect(ownedBy(kept, 'a')).toHaveLength(199);
		expect(ownedBy(kept, 'b')).toHaveLength(199);
	});

	it('three bronnen, one very large, take about a third each; the small one keeps all', () => {
		const kept = left(
			scene([
				{ id: 'cbb', n: 60 },
				{ id: 'cbw', n: 300 },
				{ id: 'sr', n: 6457 }
			])
		);
		expect(ownedBy(kept, 'cbb')).toHaveLength(60);
		// 400 places: cbb 61 with itself; the rest in two halves of 169.
		expect(ownedBy(kept, 'cbw').length).toBeGreaterThan(150);
		expect(ownedBy(kept, 'sr').length).toBeGreaterThan(150);
		expect(kept.length).toBeLessThanOrEqual(400);
		expect(kept).toEqual(expect.arrayContaining(['cbb', 'cbw', 'sr']));
	});

	it('a chosen bron of a later pick loses none to an earlier huge one', () => {
		const input = scene([
			{ id: 'sr', n: 6457 },
			{ id: 'cbb', n: 200 }
		]);
		expect(ownedBy(left(input), 'cbb').length).toBeGreaterThanOrEqual(150);
	});

	it('keeps the hull of every chosen bron, and the lines between chosen bronnen', () => {
		const input = scene([
			{ id: 'cbb', n: 500 },
			{ id: 'cbw', n: 500 }
		]);
		const hull = new Set(['cbb/n0', 'cbb/n1', 'cbb/n2']);
		const cross = [{ source: 'cbb/n2', target: 'cbw/n3' }];
		const kept = left({
			...input,
			edges: [...input.edges, ...cross],
			hullOf: (id) => (id === 'cbb' ? hull : id === 'cbw' ? new Set(['cbw/n3']) : undefined)
		});
		expect(kept).toEqual(expect.arrayContaining(['cbb/n0', 'cbb/n1', 'cbb/n2', 'cbw/n3']));
	});

	it('keeps what ties chosen bronnen (core)', () => {
		const input = scene([
			{ id: 'a', n: 500 },
			{ id: 'b', n: 500 }
		]);
		const kept = left({ ...input, core: new Set(['a/n0']) });
		expect(kept).toContain('a/n0');
	});

	it('counts a folded cluster as one place', () => {
		const input = scene([{ id: 'a', n: 100 }]);
		const members = Array.from({ length: 800 }, (_, i) => `u${i}`);
		const full = {
			...input,
			ids: [...input.ids, ...members],
			edges: [...input.edges, ...members.map((m) => ({ source: m, target: 'a' }))],
			clusters: [{ id: 'cluster:judgments', members }]
		};
		expect(costOf(full.ids, full.clusters)).toBe(102);
		expect(planTrim(full)).toEqual([]);
	});

	it('keeps a cluster whole when one of its members is an end of a line between chosen bronnen', () => {
		const input = scene([
			{ id: 'a', n: 500 },
			{ id: 'b', n: 500 }
		]);
		const members = ['a/n1', 'a/n2', 'a/n3'];
		const kept = left({
			...input,
			edges: [...input.edges, { source: 'a/n1', target: 'b/n1' }],
			hullOf: (id) => (id === 'a' ? new Set(['a/n1']) : id === 'b' ? new Set(['b/n1']) : undefined),
			clusters: [{ id: 'cluster:x', members }]
		});
		expect(kept).toEqual(expect.arrayContaining(members));
	});

	it('with room for part, keeps the heavier before the newer', () => {
		const input = scene([{ id: 'a', n: 600 }]);
		const kept = left({ ...input, weight: (id) => (id === 'a/n0' ? 5 : 0) });
		expect(kept).toContain('a/n0');
		expect(kept).toHaveLength(400);
		expect(kept).not.toContain('a/n1');
	});
});
