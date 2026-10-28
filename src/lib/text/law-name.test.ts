import { describe, expect, it } from 'vitest';
import { fallbackLawName } from './enacted-law';

describe('the name of a law without meta', () => {
	it('names a directive by its CELEX number, so its articles stand in a named hull', () => {
		expect(fallbackLawName('32004L0038')).toBe('Richtlijn 2004/38');
		expect(fallbackLawName('32016R0679')).toBe('Verordening 2016/679');
	});
	it('names a publication by its citation', () => {
		expect(fallbackLawName('STB-2026-314')).toBe('Stb. 2026, 314');
	});
});
