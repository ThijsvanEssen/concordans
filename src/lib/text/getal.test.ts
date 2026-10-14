import { describe, expect, it } from 'vitest';
import { ordinalNumber, ordinalWord } from './getal';

describe('the ordinals of a lid', () => {
	it('names a lid in words and reads it back', () => {
		expect(ordinalWord('2')).toBe('tweede');
		expect(ordinalWord('20')).toBe('twintigste');
		expect(ordinalNumber('Tweede')).toBe('2');
		expect(ordinalNumber('twintigste')).toBe('20');
	});

	it('keeps a lid beyond twenty, or with a letter, as its number', () => {
		expect(ordinalWord('21')).toBeNull();
		expect(ordinalWord('2a')).toBeNull();
		expect(ordinalWord('0')).toBeNull();
		expect(ordinalNumber('eenentwintigste')).toBeNull();
	});
});
