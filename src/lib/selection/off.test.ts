import { describe, expect, it } from 'vitest';
import { offOf, offValue, sameSet } from './off';

describe('?uit', () => {
	it('holds chosen bronnen, lijnsoorten and groupings in one list', () => {
		const off = offOf('members/x,citation,dossier,nonsense');
		expect(off).toEqual({
			chosen: ['members/x'],
			lines: ['citation'],
			annexes: false,
			groups: ['dossier']
		});
		expect(offValue(off)).toBe('members/x,citation,dossier');
	});
	it('is null where nothing is off', () => {
		expect(offValue(offOf(null))).toBeNull();
		expect(offValue(offOf(''))).toBeNull();
	});
	it('compares as sets', () => {
		expect(sameSet(['a', 'b'], new Set(['b', 'a']))).toBe(true);
		expect(sameSet(['a'], ['a', 'b'])).toBe(false);
	});
});
