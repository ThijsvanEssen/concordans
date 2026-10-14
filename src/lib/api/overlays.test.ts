import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { getHeat, heatPortions, HEAT_IDS_CHARS, HEAT_IDS_MAX } from './overlays';

const idsOf = (params: { query?: Record<string, unknown> }) => String(params.query?.ids).split(',');

describe('getHeat', () => {
	it('asks for the drawn bronnen only, in portions, and merges the answers', async () => {
		const fake = fakeApi({
			'/api/nodes/heat': ({ params }) => Object.fromEntries(idsOf(params).map((id) => [id, 3]))
		});
		const ids = Array.from({ length: 1200 }, (_, i) => `a_${i}`);
		const counts = await getHeat(12, ids);
		const sizes = fake.asked('/api/nodes/heat').map((params) => idsOf(params).length);
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
