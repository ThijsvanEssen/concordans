import { describe, expect, it } from 'vitest';
import { bewaarItem } from './map';
import { wetVanGroep } from './verbonden';

const artikel = (id: string, wet: string) => bewaarItem(id, { kort: id }, { wet });

describe('wetVanGroep', () => {
	it('gives the law of a group of articles, or of a law kept whole', () => {
		expect(wetVanGroep([artikel('articles/bwbr0052872_21', 'BWBR0052872')])).toBe('BWBR0052872');
		expect(wetVanGroep([artikel('instruments/bwbr0052872', 'BWBR0052872')])).toBe('BWBR0052872');
	});

	it('gives none for a dossier, a judgment or an act of the EU', () => {
		expect(
			wetVanGroep([bewaarItem('documents/x', { kort: 'x' }, { dossier: '36764' })])
		).toBeNull();
		expect(wetVanGroep([bewaarItem('judgments/ecli_nl_hr_2019_2006', { kort: 'HR' })])).toBeNull();
		expect(wetVanGroep([artikel('articles/32016r0679_6', '32016R0679')])).toBeNull();
	});
});
