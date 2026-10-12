import { describe, expect, it } from 'vitest';
import { wetVanGroep } from './verbonden';

describe('wetVanGroep', () => {
	it('gives the law of a group of articles, or of a law kept whole', () => {
		expect(wetVanGroep([{ id: 'articles/bwbr0052872_21' }])).toBe('BWBR0052872');
		expect(wetVanGroep([{ id: 'instruments/bwbr0052872' }])).toBe('BWBR0052872');
		expect(wetVanGroep([{ id: 'documents/kst-36764-3' }, { id: 'articles/bwbr0005289_162' }])).toBe(
			'BWBR0005289'
		);
	});

	it('gives none for a dossier, a judgment or an act of the EU', () => {
		expect(wetVanGroep([{ id: 'documents/kst-36764-3' }])).toBeNull();
		expect(wetVanGroep([{ id: 'judgments/ecli_nl_hr_2019_2006' }])).toBeNull();
		expect(wetVanGroep([{ id: 'articles/32016r0679_6' }])).toBeNull();
	});
});
