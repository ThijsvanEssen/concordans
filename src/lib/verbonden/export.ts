// The verbindingen as a CSV, with the columns of the table.
import { relationLabel, type Collection } from '$lib/vocabulary';
import { BRON_KIND_LABEL } from './filter';
import type { Row } from './rows';
import { betrouwbaarheid } from './verbinding';

export const COLUMNS = [
	'bron',
	'soort',
	'verbinding',
	'plaats in de bron',
	'plaats in dit artikel',
	'aard',
	'status',
	'betrouwbaarheid',
	'datum',
	'identificatie',
	'link'
] as const;

const cell = (v: string | null | undefined) => {
	const s = v ?? '';
	return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function rowsToCsv(rows: Row[], selection: Collection, origin: string): string {
	const lines = [COLUMNS.join(',')];
	for (const r of rows) {
		const source = r.direction === 'inbound' ? r.ref.collection : selection;
		const b = betrouwbaarheid(r.confidence, !!r.derived, null);
		lines.push(
			[
				r.title,
				BRON_KIND_LABEL[r.kind],
				r.relation ? relationLabel(r.relation, source) : '',
				r.position ?? '',
				r.lid ? `lid ${r.lid}` : '',
				r.aard ?? '',
				r.proposed ? 'voorgesteld' : 'vastgesteld',
				b.word,
				r.date ?? '',
				r.identifier ?? '',
				`${origin}/explore?mode=read&focus=${r.ref.collection}/${r.ref.key}${r.at ? `#${r.at}` : ''}`
			]
				.map(cell)
				.join(',')
		);
	}
	return lines.join('\n');
}

/** Hands the browser a file to save. */
export function download(name: string, text: string, type = 'text/csv') {
	const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The rows as lines of text, for the clipboard. */
export function rowsToText(rows: Row[]): string {
	return rows
		.map((r) =>
			[r.title, r.lid ? `lid ${r.lid}` : null, r.position, r.identifier ?? r.date]
				.filter(Boolean)
				.join(', ')
		)
		.join('\n');
}
