import { describe, expect, it } from 'vitest';
import { fromDocument, fromFeed, groupSubmitters, joinerOf, eigenFractie } from './submitters';

describe('submitters', () => {
	it('reads a document’s submitters and groups them by role, in order', () => {
		const list = fromDocument([
			{ name: 'I. Kostić', faction: 'PvdD', member_key: 'k', role: 'indiener', path: null },
			{ name: 'C. Teunissen', faction: 'PvdD', member_key: null, role: 'medeindiener', path: null },
			{ name: 'F. Klos', faction: 'D66', role: 'medeindiener', path: null }
		]);
		const { by, with: co } = groupSubmitters(list);
		expect(by.map((s) => [s.name, s.memberKey, s.faction])).toEqual([['I. Kostić', 'k', 'PvdD']]);
		expect(co.map((s) => s.name)).toEqual(['C. Teunissen', 'F. Klos']);
	});

	it('takes the indieners of a feed item and leaves a bewindspersoon out', () => {
		expect(
			fromFeed([
				{
					key: 'm',
					name: 'Mohandis',
					role: 'indiener',
					faction: { key: 'pro', short: 'PRO', path: null },
					path: null
				},
				{ key: 'b', name: 'Vijlbrief', role: 'bewindspersoon', path: null }
			])
		).toEqual([
			{ name: 'Mohandis', memberKey: 'm', faction: 'PRO', factionKey: 'pro', role: 'indiener' }
		]);
		expect(fromFeed(undefined)).toEqual([]);
	});

	it('joins names with commas and a last en, or all commas when a count follows', () => {
		expect([0, 1, 2].map((i) => joinerOf(i, 3))).toEqual(['', ', ', ' en ']);
		expect([0, 1].map((i) => joinerOf(i, 2, true))).toEqual(['', ', ']);
	});
});

describe('a faction named after its member', () => {
	it('is left out: the line says the name once (UX-toets 10 Oct, #32)', () => {
		expect(eigenFractie('Mona Keijzer', 'Lid Keijzer')).toBeNull();
		expect(eigenFractie('Gidi Markuszower', 'Groep Markuszower')).toBeNull();
		expect(eigenFractie('Caroline van der Plas', 'BBB')).toBe('BBB');
		// Part of a word is no name: "Klaver" under "GroenLinks-PvdA" stays.
		expect(eigenFractie('Jesse Klaver', 'GroenLinks-PvdA')).toBe('GroenLinks-PvdA');
		expect(eigenFractie('Mona Keijzer', null)).toBeNull();
	});
});
