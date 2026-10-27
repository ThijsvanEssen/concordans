import { describe, expect, it } from 'vitest';
import { offOf, offValue, sameSet } from './off';

describe('?uit', () => {
	it('holds chosen bronnen, lijnsoorten and groupings in one list', () => {
		const off = offOf('members/x,aanhaling,dossier,nonsense');
		expect(off).toEqual({
			chosen: ['members/x'],
			lijnen: ['aanhaling'],
			bijlagen: false,
			groups: ['dossier']
		});
		expect(offValue(off)).toBe('members/x,aanhaling,dossier');
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
