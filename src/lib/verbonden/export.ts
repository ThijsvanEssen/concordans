// The verbindingen as a CSV, with the columns of the table.
import { csvText } from '$lib/text/csv';
import { korteDatum } from '$lib/text/datum';
import { buildBronHref } from '$lib/bron/href';
import type { Collection } from '$lib/vocabulary';
import { formatCount } from '$lib/text/getal';
import { allRows, filterGroups, rowLabel, shownCount, shownLabel } from './view';
import { FILTER_GROUP_LABEL, type VerbondenFilter } from './filter';
import type { Group } from './groups';
import { mentionRows, type Row } from './rows';
import { betrouwbaarheid } from './verbinding';

/** What a cell needs besides its row: the kind of the selected bron, and the site for links. */
type ColumnContext = { selection: Collection; origin: string };

type Column = {
	id: string;
	/** The head in the table; lower case, the head in the CSV. */
	label: string;
	value: (r: Row, ctx: ColumnContext) => string;
	/** The cell in the CSV, where it differs from the table's: the date as ISO. */
	csv?: (r: Row) => string;
	sort?: (r: Row, ctx: ColumnContext) => string | number;
	/** Only in the CSV: the table shows it by the glyph or the link of the row. */
	csvOnly?: boolean;
};

/** The columns of the table and the CSV, in one order. */
export const COLUMNS: readonly Column[] = [
	{ id: 'bron', label: 'Bron', value: (r) => r.title, sort: (r) => r.title },
	{ id: 'soort', label: 'Soort', value: (r) => FILTER_GROUP_LABEL[r.filterGroup], csvOnly: true },
	{
		id: 'verbinding',
		label: 'Verbinding',
		value: (r, c) => rowLabel(r, c.selection),
		sort: (r, c) => rowLabel(r, c.selection)
	},
	{
		id: 'plaats',
		label: 'Plaats in de bron',
		value: (r) => r.position ?? '',
		sort: (r) => r.position ?? ''
	},
	{
		id: 'lid',
		label: 'Plaats in dit artikel',
		value: (r) => (r.lid ? `lid ${r.lid}` : ''),
		sort: (r) => r.lid ?? 'zz'
	},
	{ id: 'aard', label: 'Aard', value: (r) => r.aard ?? '', sort: (r) => r.aard ?? '' },
	{
		id: 'status',
		label: 'Status',
		value: (r) => (r.proposed ? 'voorgesteld' : 'vastgesteld'),
		sort: (r) => (r.proposed ? 1 : 0)
	},
	{
		id: 'betrouwbaarheid',
		label: 'Betrouwbaarheid',
		value: (r) => betrouwbaarheid(r.confidence, !!r.derived, null).word,
		sort: (r) => r.confidence ?? (r.derived ? 0.5 : 1)
	},
	{
		id: 'datum',
		label: 'Datum',
		value: (r) => korteDatum(r.date),
		csv: (r) => r.date ?? '',
		sort: (r) => r.date ?? ''
	},
	{ id: 'identificatie', label: 'Identificatie', value: (r) => r.identifier ?? '', csvOnly: true },
	{
		id: 'link',
		label: 'Link',
		value: (r, c) => `${c.origin}${buildBronHref(null, r.ref, { at: r.at })}`,
		csvOnly: true
	}
];

/** The columns of the table. */
export const TABLE_COLUMNS = COLUMNS.filter((c) => !c.csvOnly);

/** What both Exporteer buttons export: every group under the filter, the kern included, as
 *  the count of the panel and the table counts it; every mention its own row. */
export const exportRows = (groups: Group[], filter: VerbondenFilter): Row[] =>
	mentionRows(allRows(filterGroups(groups, filter)));

/** The label of both Exporteer buttons: `Exporteer 672 van 9.065` where the rows loaded are
 *  fewer than the verbindingen the count line names, as the count line writes a part. */
export function exportLabel(groups: Group[], filter: VerbondenFilter): string {
	const part = allRows(filterGroups(groups, filter)).length;
	return part < shownCount(groups, filter)
		? `Exporteer ${formatCount(part)} van ${shownLabel(groups, filter)}`
		: 'Exporteer';
}

export function rowsToCsv(rows: Row[], selection: Collection, origin: string): string {
	const ctx = { selection, origin };
	return csvText(
		COLUMNS.map((c) => c.label.toLowerCase()),
		rows.map((r) => COLUMNS.map((c) => (c.csv ? c.csv(r) : c.value(r, ctx))))
	);
}

/** `text` in characters every file system accepts, `max` at most; '' where nothing is left. */
export const safeFileName = (text: string, max = 120): string =>
	text
		// eslint-disable-next-line no-control-regex
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[.\s]+|[.\s]+$/g, '')
		.slice(0, max)
		.trim();

/** The name of the file: the verbindingen of the bron by its title; the key when the title
 *  leaves nothing. */
export function csvName(title: string | null | undefined, key: string): string {
	return `Verbindingen van ${safeFileName(title ?? '') || safeFileName(key) || 'bron'}.csv`;
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
