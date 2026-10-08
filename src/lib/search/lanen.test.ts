import { describe, expect, it } from 'vitest';
import { zoekApi } from '$lib/api/client';
import { DEBOUNCE_MS, LANEN, LANGZAAM_MS, LIVE } from './lanen';

describe('search lanes', () => {
	it('asks the judgments and the articles and stukken with the 30 s client', () => {
		for (const laan of LANEN) expect(laan.client).toBe(zoekApi);
		expect(LANEN.find((l) => l.kinds.includes('judgments'))?.min).toBe(4);
	});

	it('asks the judgments in the live mode, the rest as before', () => {
		expect(LANEN.filter((l) => l.live).map((l) => l.id)).toEqual(['uitspraken']);
	});

	it('keeps the live mode off until it is measured on prod, with the waits that go with it', () => {
		expect(LIVE).toBe(false);
		expect([DEBOUNCE_MS, LANGZAAM_MS]).toEqual([250, 300]);
	});
});
