import { describe, expect, it } from 'vitest';
import { RELATIONS } from '$lib/vocabulary';
import { bothPhrase } from './both-words';

describe('the phrase under a kenmerk', () => {
	it('is natural for the relations of a person, a stuk and a kabinet', () => {
		expect(bothPhrase('MEMBER_OF', 'cabinets', true, 2)).toBe('beide bewindspersoon in');
		expect(bothPhrase('SERVED_IN', 'ministries', true, 2)).toBe('beide bewindspersoon in');
		expect(bothPhrase('MEMBER_OF', 'committees', true, 2)).toBe('beide lid van');
		expect(bothPhrase('MEMBER_OF', 'factions', true, 3)).toBe('alle drie lid van');
		expect(bothPhrase('MEMBER_OF', 'factions', true, 4)).toBe('alle vier lid van');
		expect(bothPhrase('AUTHORED', 'documents', true, 2)).toBe('ingediend door beiden');
		expect(bothPhrase('REFERS_TO', 'documents', false, 2)).toBe('noemt beide');
		expect(bothPhrase('REFERS_TO', 'documents', false, 3)).toBe('noemt alle drie');
	});
	it('has a phrase for every relation, never "door door" or "door beide"', () => {
		for (const r of RELATIONS)
			for (const fromBron of [true, false])
				for (const row of ['cabinets', 'documents', 'committees'] as const)
					for (const n of [2, 3, 5]) {
						const p = bothPhrase(r, row, fromBron, n);
						expect(p, `${r} ${fromBron} ${n}`).toMatch(/\S/);
						expect(p).not.toMatch(/door door|door beide\b(?!n)/);
						expect(p).toMatch(/beide|beiden|alle (drie|vijf)/);
					}
	});
});
