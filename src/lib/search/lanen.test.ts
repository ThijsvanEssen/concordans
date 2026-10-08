import { describe, expect, it } from 'vitest';
import { zoekApi } from '$lib/api/client';
import { LANEN } from './lanen';

describe('search lanes', () => {
	it('asks the judgments and the articles and stukken with the 30 s client', () => {
		for (const laan of LANEN) expect(laan.client).toBe(zoekApi);
		expect(LANEN.find((l) => l.kinds.includes('judgments'))?.min).toBe(4);
	});
});
