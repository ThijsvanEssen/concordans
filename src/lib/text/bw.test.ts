import { describe, expect, it } from 'vitest';
import { articleName, bookNumber, placeInLaw, withBook } from './bw';

describe('BW article numbers', () => {
	it('puts the book before the number of a BW article', () => {
		expect(bookNumber('BWBR0005289', '162')).toBe('6:162');
		expect(bookNumber('bwbr0006000', '1576')).toBe('7A:1576');
		expect(bookNumber('BWBR0005289', '6:162')).toBe('6:162');
	});

	it('leaves other laws and missing numbers alone', () => {
		expect(bookNumber('BWBR0001854', '287')).toBe('287');
		expect(bookNumber('BWBR0005537', '3:4')).toBe('3:4');
		expect(bookNumber(null, '12')).toBe('12');
		expect(bookNumber('BWBR0005289', null)).toBeNull();
	});

	it('names a BW article as lawyers write it', () => {
		expect(withBook('Artikel 162 Burgerlijk Wetboek Boek 6')).toBe('Artikel 6:162 BW');
		expect(withBook('Artikel 40 Burgerlijk Wetboek Boek 5')).toBe('Artikel 5:40 BW');
		expect(withBook('Artikel 287 Wetboek van Strafrecht')).toBe(
			'Artikel 287 Wetboek van Strafrecht'
		);
	});
});

describe('placeInLaw', () => {
	it('leaves out the book a BW book names itself, and keeps the rest', () => {
		const place = [
			'Boek 6 Algemeen gedeelte van het verbintenissenrecht',
			'Titel 3 Onrechtmatige daad',
			'Afdeling 1 Algemene bepalingen'
		];
		expect(placeInLaw(place, 'Burgerlijk Wetboek Boek 6')).toEqual(place.slice(1));
		const sr = ['Tweede Boek Misdrijven', 'Titel XX Mishandeling'];
		expect(placeInLaw(sr, 'Wetboek van Strafrecht')).toEqual(sr);
	});
});

describe('articleName', () => {
	it('names a BW article by its book', () => {
		expect(articleName('BWBR0005289', '162')).toBe('Artikel 6:162');
	});
	it('names an article of a bijlage by the label of the API', () => {
		expect(articleName('BWBR0005537', 'bijlage 2 artikel 4', 'Artikel 4 van bijlage 2')).toBe(
			'Artikel 4 van bijlage 2'
		);
	});
	it('names an article without a number by its label', () => {
		expect(articleName('BWBR0005537', null, 'Algemene bepaling')).toBe('Algemene bepaling');
	});
});
