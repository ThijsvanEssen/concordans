import { describe, expect, it } from 'vitest';
import { offOf, offValue, sameSet } from './off';

describe('?uit', () => {
	it('holds chosen bronnen, relations and groupings in one list', () => {
		const off = offOf('members/x,REFERS_TO,dossier,nonsense');
		expect(off).toEqual({ chosen: ['members/x'], relations: ['REFERS_TO'], groups: ['dossier'] });
		expect(offValue(off)).toBe('members/x,REFERS_TO,dossier');
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
