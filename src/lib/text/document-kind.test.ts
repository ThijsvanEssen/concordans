import { describe, expect, it } from 'vitest';
import {
	belongsToBill,
	carriesBillTitle,
	isBill,
	isCoverLetter,
	isLetter,
	motionOrAmendment,
	ownKind,
	shortKind
} from './document-kind';

describe('the kind of a Kamerstuk', () => {
	it('names a motie or amendement by the word its kind opens with', () => {
		expect(motionOrAmendment('Motie (gewijzigd/nader)')).toBe('motie');
		expect(motionOrAmendment('Amendement')).toBe('amendement');
		expect(motionOrAmendment(' amendement (gewijzigd/nader/vervangend)')).toBe('amendement');
		expect(motionOrAmendment('Moties')).toBe('motie');
		expect(motionOrAmendment('Brief regering')).toBeNull();
		expect(motionOrAmendment('Verslag over moties')).toBeNull();
		expect(motionOrAmendment(null)).toBeNull();
	});

	it('knows a letter, and the letter that offers a paper', () => {
		expect(isLetter('Brief regering')).toBe(true);
		expect(isLetter('Geleidende brief')).toBe(false);
		expect(isCoverLetter('Geleidende brief')).toBe(true);
		expect(isCoverLetter('Aanbiedingsbrief')).toBe(true);
		expect(isCoverLetter('Brief regering')).toBe(false);
		expect(isCoverLetter(undefined)).toBe(false);
	});

	it('knows the bill and the papers that change or explain it', () => {
		expect(isBill('Voorstel van wet')).toBe(true);
		expect(isBill('Gewijzigd voorstel van wet')).toBe(false);
		expect(belongsToBill('Memorie van toelichting (initiatiefvoorstel)')).toBe(true);
		expect(belongsToBill('Nota naar aanleiding van het verslag')).toBe(true);
		expect(belongsToBill('Motie')).toBe(false);
		expect(carriesBillTitle('Gewijzigd voorstel van wet')).toBe(true);
		expect(carriesBillTitle('Blanco verslag')).toBe(true);
		expect(carriesBillTitle('Motie')).toBe(false);
		expect(carriesBillTitle(null)).toBe(false);
	});

	it('writes a kind short, without the group in brackets', () => {
		expect(shortKind('Motie (gewijzigd/nader)')).toBe('Motie');
		expect(shortKind('Brief regering (Kamerbrief)  ')).toBe('Brief regering');
		expect(shortKind('Wet (a) en (b)')).toBe('Wet');
	});

	it('writes a kind as a reader does: a group with a slash left out', () => {
		expect(ownKind('Amendement (gewijzigd/nader/vervangend)')).toBe('Amendement');
		expect(ownKind('Brief van lid/fractie/commissie')).toBeNull();
		expect(ownKind('Nota van wijziging (initiatiefvoorstel)')).toBe(
			'Nota van wijziging (initiatiefvoorstel)'
		);
		expect(ownKind('')).toBeNull();
	});
});

describe('carriesBillTitle', () => {
	it('knows the papers of a bill that carry its title', () => {
		for (const soort of [
			'Voorstel van wet',
			'Memorie van toelichting',
			'Nadere memorie van antwoord',
			'Nota van wijziging',
			'Nota n.a.v. het (nader/tweede nader/enz.) verslag',
			'Verslag',
			'Advies Afdeling advisering Raad van State en Nader rapport',
			'Eindtekst'
		])
			expect(carriesBillTitle(soort)).toBe(true);
	});

	it('leaves a paper with a subject of its own', () => {
		for (const soort of ['Brief regering', 'Motie', 'Amendement', 'Brief', null])
			expect(carriesBillTitle(soort)).toBe(false);
	});
});
