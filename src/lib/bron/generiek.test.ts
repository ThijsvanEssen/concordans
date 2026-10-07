import { describe, expect, it } from 'vitest';
import { draagtWetstitel, isGeneriek } from './generiek';

describe('isGeneriek', () => {
	it('takes a title that only names the kind as generic', () => {
		expect(isGeneriek('Brief', 'Brief')).toBe(true);
		expect(isGeneriek('Blanco verslag', 'Verslag')).toBe(true);
		expect(isGeneriek('Nota naar aanleiding van het verslag', 'Overig')).toBe(true);
		expect(isGeneriek('Gewijzigd voorstel van wet', 'Voorstel van wet')).toBe(true);
		expect(isGeneriek('Voorstel van wet', 'Voorstel van wet')).toBe(true);
		expect(isGeneriek('Stemmingen', 'plenaire vergadering')).toBe(true);
		expect(isGeneriek('Verslag 2', 'Verslag')).toBe(true);
		expect(isGeneriek('', 'Brief')).toBe(true);
		expect(isGeneriek(null, null)).toBe(true);
	});

	it('takes the kind with its brackets as the kind', () => {
		expect(
			isGeneriek('Nota n.a.v. het verslag', 'Nota n.a.v. het (nader/tweede nader/enz.) verslag')
		).toBe(true);
	});

	it('keeps a title with a subject, a sender or a submitter', () => {
		expect(isGeneriek('Motie van het lid Krul c.s. over de positie van pleegouders', 'Motie')).toBe(
			false
		);
		expect(isGeneriek('Brief van de minister van J&V betreffende het verzoek', 'Brief')).toBe(
			false
		);
		expect(isGeneriek('Toekomst mentale gezondheid en ggz', 'Brief regering')).toBe(false);
		expect(isGeneriek('Procedures en brieven', 'Procedurevergadering')).toBe(false);
	});
});

describe('draagtWetstitel', () => {
	it('knows the papers of a bill that carry its title', () => {
		for (const soort of [
			'Voorstel van wet',
			'Memorie van toelichting',
			'Nota van wijziging',
			'Nota n.a.v. het (nader/tweede nader/enz.) verslag',
			'Verslag',
			'Advies Afdeling advisering Raad van State en Nader rapport',
			'Eindtekst'
		])
			expect(draagtWetstitel(soort)).toBe(true);
	});

	it('leaves a paper with a subject of its own', () => {
		for (const soort of ['Brief regering', 'Motie', 'Amendement', 'Brief', null])
			expect(draagtWetstitel(soort)).toBe(false);
	});
});
