import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiNumber, articleName, articleRef, bookNumber, lawShortName, withBook } from './bw';

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

describe('articleRef', () => {
	it('cites an article by its number, a BW one with its book', () => {
		expect(articleRef('BWBR0005289', '162')).toBe('art. 6:162');
		expect(articleRef(null, 'I', { form: 'Artikel' })).toBe('Artikel I');
	});
	it('names the sole article of a law by its label, else the name its number spells', () => {
		expect(articleRef('BWBR0007846', 'enig-artikel', { label: 'Enig artikel' })).toBe(
			'Enig artikel'
		);
		expect(articleRef('BWBR0007846', 'enig-artikel')).toBe('Enig artikel');
		expect(articleName('BWBR0007846', 'enig-artikel', 'Enig artikel')).toBe('Enig artikel');
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

describe('one way to cite an article by its number', () => {
	// `art. ${x.article_number}` printed "art. enig-artikel": every number from the API goes
	// through articleRef or articleName, which name the sole article of a law by its label.
	const root = join(process.cwd(), 'src');
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) return name === 'generated' ? [] : files(path);
			return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
		});
	it('leaves no template that prints an article_number after "art." or "Artikel"', () => {
		const raw = /(?:art\.|[Aa]rtikel) \$?\{[^}]*article_number/;
		const offenders = files(root)
			.filter((f) => raw.test(readFileSync(f, 'utf8')))
			.map((f) => relative(root, f));
		expect(offenders).toEqual([]);
	});
});
