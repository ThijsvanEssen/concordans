// The one CSV of the site: every export writes it here, and the coding is read back here.

export type CsvCell = string | number | null | undefined;

export type CsvFormat = { separator: string; bom: boolean };

/** As Excel with Dutch settings reads a CSV: semicolons and a byte order mark. */
export const EXCEL_FORMAT: CsvFormat = { separator: ';', bom: true };

/** The coding of a topic, shared as a file: commas, as the files already shared were written. */
export const CODING_FORMAT: CsvFormat = { separator: ',', bom: false };

const BOM = '\uFEFF';
const LINE_END = '\r\n';

/** A cell; quoted, its quotes doubled, where it holds a quote, the separator or a line end. */
export function csvCell(value: CsvCell, separator = EXCEL_FORMAT.separator): string {
	const text = value == null ? '' : String(value);
	const quote = /["\r\n]/.test(text) || text.includes(separator);
	return quote ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A head and its rows as a CSV file. */
export function csvText(
	head: readonly string[],
	rows: readonly (readonly CsvCell[])[],
	format: CsvFormat = EXCEL_FORMAT
): string {
	const lines = [head, ...rows].map((row) =>
		row.map((cell) => csvCell(cell, format.separator)).join(format.separator)
	);
	return (format.bom ? BOM : '') + lines.join(LINE_END);
}

/** A CSV file read back into rows of cells, its head the first; quoted line ends included. */
export function parseCsv(text: string, format: CsvFormat = EXCEL_FORMAT): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	const source = text.startsWith(BOM) ? text.slice(BOM.length) : text;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (quoted) {
			if (ch === '"' && source[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else cell += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === format.separator) {
			row.push(cell);
			cell = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && source[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}
