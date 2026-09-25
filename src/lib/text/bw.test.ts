import { describe, expect, it } from 'vitest';
import { bookNumber, withBook } from './bw';

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
