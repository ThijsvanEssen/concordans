import { describe, expect, it } from 'vitest';
import { CODING_FORMAT, csvCell, csvText, parseCsv } from './csv';

const title = 'Motie over "huur", nr. 3\r\nen een tweede regel; met puntkomma';

describe('csvCell', () => {
	it('leaves a plain value as it is', () => {
		expect(csvCell('art. 6:162 BW')).toBe('art. 6:162 BW');
		expect(csvCell(12)).toBe('12');
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
	});

	it('quotes a value with a quote, the separator or a line end, the quotes doubled', () => {
		expect(csvCell('a "b"')).toBe('"a ""b"""');
		expect(csvCell('a;b')).toBe('"a;b"');
		expect(csvCell('a,b')).toBe('a,b');
		expect(csvCell('a,b', ',')).toBe('"a,b"');
		expect(csvCell('a\nb')).toBe('"a\nb"');
		expect(csvCell('a\rb')).toBe('"a\rb"');
	});
});

describe('csvText', () => {
	it('writes as Excel with Dutch settings reads it: a byte order mark, semicolons', () => {
		expect(csvText(['a', 'b'], [['1', 'x;y']])).toBe('﻿a;b\r\n1;"x;y"');
	});

	it('writes the coding with commas and without a byte order mark', () => {
		expect(csvText(['a', 'b'], [['1', 'x,y']], CODING_FORMAT)).toBe('a,b\r\n1,"x,y"');
	});
});

describe('parseCsv', () => {
	it('reads back what csvText writes, quotes, separators and line ends included', () => {
		for (const format of [undefined, CODING_FORMAT]) {
			const text = csvText(
				['kop', 'titel'],
				[
					['d1', title],
					['d2', '']
				],
				format
			);
			expect(parseCsv(text, format)).toEqual([
				['kop', 'titel'],
				['d1', title],
				['d2', '']
			]);
		}
	});

	it('reads lines ended by a line feed alone, and no empty row after the last', () => {
		expect(parseCsv('a,b\nc,d\n', CODING_FORMAT)).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});
});
