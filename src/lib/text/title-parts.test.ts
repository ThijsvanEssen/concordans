import { describe, expect, it } from 'vitest';
import { titleParts } from './title-parts';

describe('titleParts', () => {
	it('breaks an ECLI between its court and its year alone', () => {
		expect(
			titleParts("Hof 's-Hertogenbosch 20\u00a0oktober\u00a02026, ECLI:NL:GHSHE:2026:2880")
		).toEqual(["Hof 's-Hertogenbosch 20\u00a0oktober\u00a02026, ECLI:NL:GHSHE:", '2026:2880']);
	});

	it('breaks after any other colon', () => {
		expect(titleParts('Art. 5:40 BW')).toEqual(['Art. 5:', '40 BW']);
		expect(titleParts('Wet zonder dubbele punt')).toEqual(['Wet zonder dubbele punt']);
	});
});
