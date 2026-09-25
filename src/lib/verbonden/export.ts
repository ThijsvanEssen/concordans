// The verbindingen as a CSV, with the columns of the table. Separated by semicolons and
// preceded by a byte order mark, as Excel with Dutch settings reads a CSV.
import { buildBronHref } from '$lib/bron/href';
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

const SEP = ';';
const BOM = '\uFEFF';

const cell = (v: string | null | undefined) => {
	const s = v ?? '';
	return /[";,\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function rowsToCsv(rows: Row[], selection: Collection, origin: string): string {
	const lines = [COLUMNS.join(SEP)];
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
				`${origin}${buildBronHref(null, r.ref, { at: r.at })}`
			]
				.map(cell)
				.join(SEP)
		);
	}
	return BOM + lines.join('\r\n');
}

/** The name of the file: the verbindingen of the bron by its title, in characters every
 *  file system accepts; the key when the title leaves nothing. */
export function csvName(title: string | null | undefined, key: string): string {
	const safe = (s: string) =>
		s
			// eslint-disable-next-line no-control-regex
			.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
			.replace(/\s+/g, ' ')
			.replace(/^[.\s]+|[.\s]+$/g, '')
			.slice(0, 120)
			.trim();
	return `Verbindingen van ${safe(title ?? '') || safe(key) || 'bron'}.csv`;
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
