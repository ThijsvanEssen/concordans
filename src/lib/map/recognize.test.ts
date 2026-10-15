import { describe, expect, it } from 'vitest';
import { recognize } from './recognize';

describe('a pasted source Concordans holds', () => {
	it.each([
		[
			'https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:HR:2005:AU3313',
			'/uitspraken/ECLI:NL:HR:2005:AU3313',
			'ECLI:NL:HR:2005:AU3313'
		],
		[
			'HR 11 november 2005, ECLI:NL:HR:2005:AU3313 (Kooiker).',
			'/uitspraken/ECLI:NL:HR:2005:AU3313',
			'ECLI:NL:HR:2005:AU3313'
		],
		[
			'https://wetten.overheid.nl/BWBR0005290/2024-01-01#Boek7',
			'/wetten/BWBR0005290',
			'BWBR0005290'
		],
		[
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679',
			'/wetten/32016R0679',
			'32016R0679'
		],
		[
			'https://zoek.officielebekendmakingen.nl/kst-36600-VIII-14.html',
			'/kamerstukken/36600-VIII/14',
			'Kamerstuk 36600 VIII, nr. 14'
		],
		[
			'https://zoek.officielebekendmakingen.nl/kst-36799-31',
			'/kamerstukken/36799/31',
			'Kamerstuk 36799, nr. 31'
		],
		['https://zoek.officielebekendmakingen.nl/stb-2026-94.html', '/stb/2026/94', 'Stb. 2026, 94'],
		[
			'https://concordans.nl/wetten/BWBR0005290/artikel/7:658',
			'/wetten/BWBR0005290/artikel/7:658',
			'art. 7:658, BWBR0005290'
		]
	])('%s', (text, path, label) => {
		expect(recognize(text)).toMatchObject({ path, label });
	});

	it('names the law it found, so the form can name it as its reader does (#6)', () => {
		expect(recognize('https://wetten.overheid.nl/BWBR0005289/2024-01-01')).toMatchObject({
			law: 'BWBR0005289'
		});
		expect(recognize('https://concordans.nl/wetten/BWBR0005290/artikel/7:658')).toMatchObject({
			law: 'BWBR0005290',
			article: '7:658'
		});
		expect(recognize('ECLI:NL:HR:2005:AU3313')?.law).toBeUndefined();
	});

	it('reads the address of this site too, and nothing else', () => {
		expect(recognize('http://localhost:5199/uitspraken/ECLI:NL:HR:2019:2006')?.path).toBe(
			'/uitspraken/ECLI:NL:HR:2019:2006'
		);
		expect(recognize('https://example.org/x', 'https://example.org')).toBeNull();
		expect(recognize('Asser/Hartkamp & Sieburgh 6-IV 2019/45')).toBeNull();
		expect(recognize('https://www.navigator.nl/document/abc')).toBeNull();
		expect(recognize('https://concordans.nl/gemarkeerd')).toBeNull();
		expect(recognize('')).toBeNull();
	});
});
