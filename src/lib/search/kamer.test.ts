import { describe, expect, it } from 'vitest';
import { kamerLinks, kamerOf } from './kamer';

describe('kamerOf', () => {
	it('names the Kamer a query names in full', () => {
		expect(kamerOf('Eerste Kamer')).toBe('EK');
		expect(kamerOf(' de tweede  kamer ')).toBe('TK');
		expect(kamerOf('Eerste Kamer der Staten-Generaal')).toBe('EK');
	});

	it('leaves a query that only contains it', () => {
		expect(kamerOf('Eerste Kamer stemming huurcommissie')).toBeNull();
		expect(kamerOf('kamer')).toBeNull();
	});

	it('points at the leden, fracties and stemmingen of that Kamer', () => {
		expect(kamerLinks('EK').map((l) => l.href)).toEqual([
			'/explore?mode=index&kind=members&kamer=EK',
			'/explore?mode=index&kind=factions&kamer=EK',
			'/explore?mode=index&kind=decisions&kamer=EK'
		]);
	});
});
