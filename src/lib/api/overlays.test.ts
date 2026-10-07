import { describe, expect, it, vi } from 'vitest';

const GET = vi.fn(async (_path: string, opts: { params: { query: { ids: string } } }) => ({
	data: Object.fromEntries(opts.params.query.ids.split(',').map((id) => [id, 3])),
	response: new Response(null, { status: 200 })
}));
vi.mock('./client', async (original) => ({
	...(await original<typeof import('./client')>()),
	api: { GET }
}));

const { getHeat, heatPortions, HEAT_IDS_CHARS, HEAT_IDS_MAX } = await import('./overlays');

describe('getHeat', () => {
	it('asks for the drawn bronnen only, in portions, and merges the answers', async () => {
		const ids = Array.from({ length: 1200 }, (_, i) => `a_${i}`);
		const counts = await getHeat(12, ids);
		const sizes = GET.mock.calls.map(([, o]) => o.params.query.ids.split(',').length);
		expect(sizes).toEqual([HEAT_IDS_MAX, HEAT_IDS_MAX, 200]);
		expect(counts.size).toBe(1200);
		expect(counts.get('a_0')).toBe(3);
	});

	it('keeps a portion short enough for a request line (Awb articles: 30 characters each)', () => {
		const ids = Array.from({ length: 500 }, (_, i) => `articles/bwbr0005537_${i}_${i}`);
		const portions = heatPortions(ids);
		expect(portions.length).toBeGreaterThan(1);
		for (const p of portions)
			expect(encodeURIComponent(p.join(',')).length).toBeLessThanOrEqual(HEAT_IDS_CHARS);
		expect(portions.flat()).toEqual(ids);
	});
});
