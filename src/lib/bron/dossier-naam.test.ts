import { describe, expect, it } from 'vitest';
import { dossierLabel, dossierName } from './dossier-naam';

describe('dossierLabel', () => {
	const d = (short_title: string | null, title: string | null) => ({
		key: '36600',
		number: '36600',
		title,
		short_title
	});

	it('puts the kind and number first and the name the API gives after it', () => {
		expect(dossierLabel({ number: '36496', short_title: 'Wet betaalbare huur' })).toBe(
			'Dossier 36496 Wet betaalbare huur'
		);
		expect(
			dossierLabel({
				number: '36889',
				short_title: 'Archiefwet 1995',
				short_title_basis: 'amended_law'
			})
		).toBe('Dossier 36889 wijziging van Archiefwet 1995');
	});

	it('cuts a long title without a short one, and keeps the number alone without either', () => {
		const lang = 'Regels over '.repeat(10).trim();
		const naam = dossierName({ number: '1', title: lang });
		expect(naam.length).toBeLessThanOrEqual(80);
		expect(naam.endsWith('…')).toBe(true);
		expect(dossierLabel({ number: '36600-VII' })).toBe('Dossier 36600 VII');
	});

	it('uses the short title', () => {
		expect(dossierLabel(d('Begroting JenV', 'Vaststelling van de begrotingsstaten'))).toBe(
			'Dossier 36600 Begroting JenV'
		);
	});
	it('falls back to the whole title, without parsing it', () => {
		expect(
			dossierLabel(d(null, 'Wijziging van de Vreemdelingenwet 2000 (Wet tweestatusstelsel)'))
		).toBe('Dossier 36600 Wijziging van de Vreemdelingenwet 2000 (Wet tweestatusstelsel)');
	});
	it('is the number alone without any title', () => {
		expect(dossierLabel(d(null, null))).toBe('Dossier 36600');
	});
});

describe('dossierName', () => {
	it('takes the official short title, and names an amended law as its change', () => {
		expect(
			dossierName({
				number: '37014',
				short_title: 'Wet weerbare waarden',
				short_title_basis: 'title'
			})
		).toBe('Wet weerbare waarden');
		expect(
			dossierName({
				number: '36889',
				title: 'Wijziging van de Archiefwet 1995 ter verruiming van de mogelijkheden',
				short_title: 'Archiefwet 1995',
				short_title_basis: 'amended_law'
			})
		).toBe('wijziging van Archiefwet 1995');
	});

	it('falls back on the title, cut, and on the number', () => {
		const title =
			'Vaststelling van de begrotingsstaten van Koninkrijksrelaties (IV) en het BES-fonds (H) voor het jaar 2027';
		expect(dossierName({ number: '37020-IV', title })).toBe(`${title.slice(0, 79).trimEnd()}…`);
		expect(dossierName({ number: '36892', title: 'Wijziging van de Gemeentewet' })).toBe(
			'Wijziging van de Gemeentewet'
		);
		expect(dossierName({ number: '36000' })).toBe('36000');
	});
});
