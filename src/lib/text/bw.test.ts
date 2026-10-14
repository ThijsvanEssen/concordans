import { describe, expect, it } from 'vitest';
import { apiNumber, articleName, articleTitle, bookNumber, lawShortName, withBook } from './bw';

describe('BW article numbers', () => {
	it('gives the number the API gives a BW article, without its book', () => {
		expect(apiNumber('BWBR0005289', '6:162')).toBe('162');
		expect(apiNumber('BWBR0006000', '7a:1576')).toBe('1576');
		expect(apiNumber('BWBR0005289', '162')).toBe('162');
		expect(apiNumber('BWBR0001854', '126ffa')).toBe('126ffa');
	});

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

describe('articleTitle', () => {
	it('names an article by the abbreviation of its law', () => {
		const evrm = { instrument_abbreviation: 'EVRM', article_number: '8' };
		expect(articleTitle('Artikel 8 Verdrag tot bescherming van de rechten van de mens', evrm)).toBe(
			'Artikel 8 EVRM'
		);
		expect(
			articleTitle('Artikel 3:4 Algemene wet bestuursrecht', {
				instrument_abbreviation: 'Awb',
				article_number: '3:4'
			})
		).toBe('Artikel 3:4 Awb');
	});

	it('keeps the book of a BW article and the name where there is no abbreviation', () => {
		expect(
			articleTitle('Artikel 162 Burgerlijk Wetboek Boek 6', {
				instrument_abbreviation: 'BW6',
				article_number: '162'
			})
		).toBe('Artikel 6:162 BW');
		expect(articleTitle('Artikel 1 Wet X', { article_number: '1' })).toBe('Artikel 1 Wet X');
	});
});

describe('lawShortName', () => {
	it('names a book of the BW as lawyers do, never by its BWB abbreviation (#68)', () => {
		expect(lawShortName('BWBR0006000', 'BW7A')).toBe('Boek 7A BW');
		expect(lawShortName('bwbr0005289', 'BW6')).toBe('Boek 6 BW');
		expect(lawShortName('BWBR0005537', 'Awb')).toBe('Awb');
		expect(lawShortName('BWBR0005537', null)).toBeNull();
	});
});
