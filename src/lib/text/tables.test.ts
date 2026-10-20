import { describe, expect, it } from 'vitest';
import fixture from '$lib/fixtures/article-bwbr0045077_2.json';
import { rowsOf, piecesOf, type Table } from './tables';

// Art. 2 Regeling aanwijzing aanbieders essentiële diensten EZK: a sentence, then a table of
// three columns under a header, its sectors each spanning the rows of their providers.
const { text, tables } = fixture.article;
const table = tables[0] as Table;

describe('the rows of a table in a text', () => {
	const rows = rowsOf(text, table);
	const cells = (i: number) => rows[i].cells.map((c) => text.slice(c.start, c.end));

	it('reads the header and the cells of each row by their offsets', () => {
		expect(rows.map((r) => r.head)).toEqual([true, ...Array(9).fill(false)]);
		expect(cells(0)).toEqual(['Sector', 'Aanbieder', 'Essentiële dienst']);
		expect(cells(1)[0]).toBe('Digitale infrastructuur');
		expect(cells(2)[0]).toMatch(/^Een beheerder van een register/);
	});

	it('spans a cell over the rows the source says', () => {
		expect(rows[1].cells[0]).toMatchObject({ rowspan: 3, colspan: 1 });
		expect(rows[8].cells[0]).toMatchObject({ rowspan: 2 });
		expect(rows[2].cells.length).toBe(2);
	});

	it('spans columns', () => {
		const t: Table = {
			start: 0,
			end: 7,
			head_rows: 0,
			columns: 2,
			spans: [{ row: 0, cell: 0, cols: 2, rows: 1 }]
		};
		expect(rowsOf('ab\nc\td', t)[0].cells).toEqual([{ start: 0, end: 2, colspan: 2, rowspan: 1 }]);
	});
});

describe('a text in pieces around its tables', () => {
	it('gives the text before, the table and the text after', () => {
		const t = { start: 4, end: 8, head_rows: 0, columns: 2, spans: [] };
		expect(piecesOf(0, 12, [t])).toEqual([
			{ start: 0, end: 4, table: null },
			{ start: 4, end: 8, table: t },
			{ start: 8, end: 12, table: null }
		]);
		expect(piecesOf(0, 6, [t])).toEqual([{ start: 0, end: 6, table: null }]);
	});
});
