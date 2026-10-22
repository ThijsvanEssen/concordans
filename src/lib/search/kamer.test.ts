import { describe, expect, it } from 'vitest';
import { chamberLinks, chamberOf } from './kamer';

describe('chamberOf', () => {
	it('names the Kamer a query names in full', () => {
		expect(chamberOf('Eerste Kamer')).toBe('EK');
		expect(chamberOf(' de tweede  kamer ')).toBe('TK');
		expect(chamberOf('Eerste Kamer der Staten-Generaal')).toBe('EK');
	});

	it('leaves a query that only contains it', () => {
		expect(chamberOf('Eerste Kamer stemming huurcommissie')).toBeNull();
		expect(chamberOf('kamer')).toBeNull();
	});

	it('points at the leden, fracties and stemmingen of that Kamer', () => {
		expect(chamberLinks('EK').map((l) => l.href)).toEqual([
			'/explore?mode=index&kind=members&kamer=EK',
			'/explore?mode=index&kind=factions&kamer=EK',
			'/explore?mode=index&kind=decisions&kamer=EK'
		]);
	});
});
