import { describe, expect, it } from 'vitest';
import { hasOwnOutcome, numbersText, replacementsOf, type Replacement } from '$lib/text/vervanging';

/** A phrase as the status line reads it: its word, then its numbers. */
const alsTekst = (z: Replacement) => `${z.woord} ${numbersText(z.nrs)}`;

const ref = (n: number | null) => ({ id: `documents/d${n}`, key: `d${n}`, sequence: n });

describe('the chain of an amended stuk in its status line', () => {
	it('names the one stuk it replaces', () => {
		expect(replacementsOf({ replaces: [ref(10)], replaced_by: [] }).map(alsTekst)).toEqual([
			'Vervangt nr. 10'
		]);
	});

	it('names several in the order of their numbers, with "nrs." and "en"', () => {
		expect(replacementsOf({ replaces: [ref(38), ref(26)] }).map(alsTekst)).toEqual([
			'Vervangt nrs. 26 en 38'
		]);
		expect(replacementsOf({ replaces: [ref(38), ref(26), ref(30)] }).map(alsTekst)).toEqual([
			'Vervangt nrs. 26, 30 en 38'
		]);
	});

	it('names what replaced it, the direct step only', () => {
		const z = replacementsOf({ replaces: [], replaced_by: [ref(47)] });
		expect(z.map(alsTekst)).toEqual(['Vervangen door nr. 47']);
		expect(z[0].nrs).toEqual([{ key: 'd47', nummer: '47' }]);
	});

	it('gives a stuk in the middle of a chain both, what it replaces first', () => {
		expect(replacementsOf({ replaces: [ref(22)], replaced_by: [ref(40)] }).map(alsTekst)).toEqual([
			'Vervangt nr. 22',
			'Vervangen door nr. 40'
		]);
	});

	it('says nothing for a stuk outside a chain, or one without a number', () => {
		expect(replacementsOf({})).toEqual([]);
		expect(replacementsOf({ replaces: [], replaced_by: [] })).toEqual([]);
		expect(replacementsOf({ replaces: [ref(null)] })).toEqual([]);
	});

	it('keeps the outcome on the stuk that came to the vote, not on a replaced one', () => {
		// 36496: nr. 10 replaced by nr. 47, nr. 47 verworpen 37–113.
		expect(hasOwnOutcome({ replaces: [ref(10)], replaced_by: [] })).toBe(true);
		expect(hasOwnOutcome({ replaced_by: [ref(47)] })).toBe(false);
		expect(hasOwnOutcome({})).toBe(true);
	});
});
