// The outcome of a decision has one reading (audit dubbele helpers, punt 4): `uitslag` in
// $lib/votes/decision-kind reads `passed`, the Eerste Kamer's `result` and the BesluitSoort
// (a hamerstuk, a vote postponed) together. A reader of its own forgot one of the three: the
// dossier's timeline knew no hamerstuk, the amendementen no `result`.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

const EIGEN = plek('lib/votes/decision-kind.ts');

describe('the outcome of a decision', () => {
	it('is read by uitslag alone: no uitslagVan of its own', () => {
		const eigen = /(?:function\s+|const\s+)uitslag(?:Van)?\s*(?:\(|=\s*(?:\(|function))/;
		expect(overtreders((t) => eigen.test(t), [EIGEN])).toEqual([]);
	});

	it("reads the Eerste Kamer's result and the BesluitSoort in one place", () => {
		const bron = /result\s*===\s*'(?:Aangenomen|Verworpen)'|uitstellen\|/;
		expect(overtreders((t) => bron.test(t), [EIGEN])).toEqual([]);
	});
});
