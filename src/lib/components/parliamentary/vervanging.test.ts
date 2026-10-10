import { describe, expect, it } from 'vitest';
import { alsTekst, eigenUitslag, vervanging } from './vervanging';

const ref = (n: number | null) => ({ id: `documents/d${n}`, key: `d${n}`, sequence: n });

describe('the chain of an amended stuk in its status line', () => {
	it('names the one stuk it replaces', () => {
		expect(vervanging({ replaces: [ref(10)], replaced_by: [] }).map(alsTekst)).toEqual([
			'Vervangt nr. 10'
		]);
	});

	it('names several in the order of their numbers, with "nrs." and "en"', () => {
		expect(vervanging({ replaces: [ref(38), ref(26)] }).map(alsTekst)).toEqual([
			'Vervangt nrs. 26 en 38'
		]);
		expect(vervanging({ replaces: [ref(38), ref(26), ref(30)] }).map(alsTekst)).toEqual([
			'Vervangt nrs. 26, 30 en 38'
		]);
	});

	it('names what replaced it, the direct step only', () => {
		const z = vervanging({ replaces: [], replaced_by: [ref(47)] });
		expect(z.map(alsTekst)).toEqual(['Vervangen door nr. 47']);
		expect(z[0].nrs).toEqual([{ key: 'd47', nummer: '47' }]);
	});

	it('gives a stuk in the middle of a chain both, what it replaces first', () => {
		expect(vervanging({ replaces: [ref(22)], replaced_by: [ref(40)] }).map(alsTekst)).toEqual([
			'Vervangt nr. 22',
			'Vervangen door nr. 40'
		]);
	});

	it('says nothing for a stuk outside a chain, or one without a number', () => {
		expect(vervanging({})).toEqual([]);
		expect(vervanging({ replaces: [], replaced_by: [] })).toEqual([]);
		expect(vervanging({ replaces: [ref(null)] })).toEqual([]);
	});

	it('keeps the outcome on the stuk that came to the vote, not on a replaced one', () => {
		// 36496: nr. 10 replaced by nr. 47, nr. 47 verworpen 37–113.
		expect(eigenUitslag({ replaces: [ref(10)], replaced_by: [] })).toBe(true);
		expect(eigenUitslag({ replaced_by: [ref(47)] })).toBe(false);
		expect(eigenUitslag({})).toBe(true);
	});
});
