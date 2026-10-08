import { describe, expect, it } from 'vitest';
import { zoekApi } from '$lib/api/client';
import { DEBOUNCE_MS, LANEN, LANGZAAM_MS, LIVE } from './lanen';

describe('search lanes', () => {
	it('asks the judgments and the articles and stukken with the 30 s client', () => {
		for (const laan of LANEN) expect(laan.client).toBe(zoekApi);
		expect(LANEN.find((l) => l.kinds.includes('judgments'))?.min).toBe(3);
	});

	it('asks every lane in the live mode', () => {
		expect(LANEN.filter((l) => l.live).map((l) => l.id)).toEqual(['tekst', 'uitspraken']);
	});

	it('has the live mode on since 0.79.12 (measured on prod), with the waits that go with it', () => {
		expect(LIVE).toBe(true);
		expect([DEBOUNCE_MS, LANGZAAM_MS]).toEqual([150, 150]);
	});
});
