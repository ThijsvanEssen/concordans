import { describe, expect, it } from 'vitest';
import { COLUMNS, csvName, rowsToCsv } from './export';
import type { Row } from './rows';

describe('rowsToCsv', () => {
	const row: Row = {
		ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_1278' },
		title: 'Hoge Raad; "uitspraak", 19 juli 2019',
		context: null,
		kind: 'uitspraken',
		position: 'r.o. 2.2',
		identifier: 'ECLI:NL:HR:2019:1278',
		date: '2019-07-19'
	};

	it('starts with a byte order mark and separates by semicolons', () => {
		const csv = rowsToCsv([row], 'articles', 'https://example.org');
		expect(csv.startsWith('\uFEFF')).toBe(true);
		const [head, line] = csv.slice(1).split('\r\n');
		expect(head).toBe(COLUMNS.join(';'));
		expect(line.startsWith('"Hoge Raad; ""uitspraak"", 19 juli 2019";')).toBe(true);
		expect(line).toContain(';r.o. 2.2;');
		expect(line).toContain(';ECLI:NL:HR:2019:1278;https://example.org/');
	});
});

describe('csvName', () => {
	it('names the file after the bron', () => {
		expect(csvName('Art. 287 Sr', 'bwbr0001854_287')).toBe('Verbindingen van Art. 287 Sr.csv');
	});

	it('leaves out characters a file system refuses', () => {
		expect(csvName('Wet a/b: "c" <d>?', 'k')).toBe('Verbindingen van Wet a b c d.csv');
	});

	it('falls back to the key', () => {
		expect(csvName('  ', 'bwbr0001854_287')).toBe('Verbindingen van bwbr0001854_287.csv');
		expect(csvName(null, 'k')).toBe('Verbindingen van k.csv');
	});
});
