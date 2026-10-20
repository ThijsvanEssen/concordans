// A table in a text: the API keeps it in the text, a row a line and its cells separated by
// a tab, and describes it as a span of that text (`tables`: start, end, the rows of its
// header, its cells that span rows or columns). Only TextTable lays one out.
import type { Schema } from '$lib/api/types';

export type Table = Schema<'ArticleTableDTO'>;

export type TableCell = {
	/** Offsets of its text in the whole text. */
	start: number;
	end: number;
	colspan: number;
	rowspan: number;
};

type TableRow = { head: boolean; cells: TableCell[] };

/** The rows of `table` and their cells, as offsets into `text`; the first `head_rows` rows
 *  are its header. */
export function rowsOf(text: string, table: Table): TableRow[] {
	const span = new Map((table.spans ?? []).map((s) => [`${s.row}/${s.cell}`, s]));
	const rows: TableRow[] = [];
	let at = table.start;
	for (const [r, line] of text.slice(table.start, table.end).split('\n').entries()) {
		const cells: TableCell[] = [];
		let from = at;
		for (const [c, cell] of line.split('\t').entries()) {
			const s = span.get(`${r}/${c}`);
			cells.push({
				start: from,
				end: from + cell.length,
				colspan: s?.cols ?? 1,
				rowspan: s?.rows ?? 1
			});
			from += cell.length + 1;
		}
		rows.push({ head: r < table.head_rows, cells });
		at += line.length + 1;
	}
	return rows;
}

type TablePiece = { start: number; end: number; table: Table | null };

/** `text[from, to)` in pieces: the tables that lie in it, and the text around them. */
export function piecesOf(from: number, to: number, tables: readonly Table[]): TablePiece[] {
	const pieces: TablePiece[] = [];
	let at = from;
	for (const table of [...tables].sort((a, b) => a.start - b.start)) {
		if (table.start < at || table.end > to) continue;
		if (table.start > at) pieces.push({ start: at, end: table.start, table: null });
		pieces.push({ start: table.start, end: table.end, table });
		at = table.end;
	}
	if (to > at) pieces.push({ start: at, end: to, table: null });
	return pieces;
}
