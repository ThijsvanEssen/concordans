import { describe, expect, it } from 'vitest';
import { metEersteKamer } from './behoort-rules';

describe('the Kamers that dealt with a dossier', () => {
	const tk = [{ soort: 'Kamer', naam: 'Tweede Kamer' }];
	it('adds the Eerste Kamer where the detail holds its papers or its outcome there', () => {
		expect(metEersteKamer(tk, { senate: { document_count: 14 } })).toEqual([
			{ soort: 'Kamer', naam: 'Tweede Kamer en Eerste Kamer' }
		]);
		expect(metEersteKamer(tk, { ek_outcome: { outcome: 'Aangenomen' } })[0].naam).toBe(
			'Tweede Kamer en Eerste Kamer'
		);
		expect(metEersteKamer(tk, { senate: { document_count: 0 }, ek_outcome: null })).toEqual(tk);
		expect(metEersteKamer([], { senate: { document_count: 3 } })[0].naam).toBe('Eerste Kamer');
	});
});
