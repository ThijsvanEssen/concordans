import { describe, expect, it } from 'vitest';
import { dossierLabel, dossierName } from './dossier-naam';

describe('dossierLabel', () => {
	it('puts the kind and number first and the name the API gives after it', () => {
		expect(dossierLabel({ number: '36496', short_title: 'Wet betaalbare huur' })).toBe(
			'Kamerstuk 36496 Wet betaalbare huur'
		);
		expect(
			dossierLabel({
				number: '36889',
				short_title: 'Archiefwet 1995',
				short_title_basis: 'amended_law'
			})
		).toBe('Kamerstuk 36889 wijziging van Archiefwet 1995');
	});

	it('cuts a long title without a short one, and keeps the number alone without either', () => {
		const lang = 'Regels over '.repeat(10).trim();
		const naam = dossierName({ number: '1', title: lang });
		expect(naam.length).toBeLessThanOrEqual(80);
		expect(naam.endsWith('…')).toBe(true);
		expect(dossierLabel({ number: '36600-VII' })).toBe('Kamerstuk 36600-VII');
	});
});
