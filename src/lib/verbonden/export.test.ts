import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	COLUMNS,
	TABLE_COLUMNS,
	columnLabel,
	csvName,
	exportLabel,
	exportRows,
	rowsToCsv
} from './export';
import { safeFileName } from '$lib/util/save-file';
import { EMPTY_FILTER } from './filter';
import type { Group } from './groups';
import type { Row } from './rows';

describe('rowsToCsv', () => {
	const row: Row = {
		ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_1278' },
		title: 'Hoge Raad; "uitspraak", 19 juli 2019',
		context: null,
		filterGroup: 'uitspraken',
		position: 'r.o. 2.2',
		identifier: 'ECLI:NL:HR:2019:1278',
		date: '2019-07-19'
	};

	it('starts with a byte order mark and separates by semicolons', () => {
		const csv = rowsToCsv([row], 'articles', 'https://example.org');
		expect(csv.startsWith('\uFEFF')).toBe(true);
		const [head, line] = csv.slice(1).split('\r\n');
		expect(head).toBe(COLUMNS.map((c) => c.label.toLowerCase()).join(';'));
		expect(line.startsWith('"Hoge Raad; ""uitspraak"", 19 juli 2019";')).toBe(true);
		expect(line).toContain(';r.o. 2.2;');
		expect(line).toContain(';ECLI:NL:HR:2019:1278;https://example.org/');
	});
});

describe('safeFileName', () => {
	it('keeps a name to the characters and the length a file system takes', () => {
		expect(safeFileName('stikstof; "natuur"/water', 12)).toBe('stikstof; na');
		expect(safeFileName(' ..?.. ')).toBe('');
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

describe('the columns', () => {
	it('are the CSV head, in its order and words', () => {
		expect(COLUMNS.map((c) => c.label.toLowerCase())).toEqual([
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
		]);
	});

	it('give the table every column the CSV does not keep to itself', () => {
		expect(TABLE_COLUMNS.map((c) => c.id)).toEqual(
			COLUMNS.filter((c) => !c.csvOnly).map((c) => c.id)
		);
	});
});

describe('the places on the page of a judgment', () => {
	const column = (id: string) => TABLE_COLUMNS.find((c) => c.id === id)!;
	const ctx = { selection: 'judgments' as const, origin: '' };
	const cites: Row = {
		ref: { collection: 'articles', key: 'bwbr0005290_6_162' },
		title: 'Art. 6:162 BW',
		context: null,
		filterGroup: 'artikelen',
		direction: 'outbound',
		lid: '2',
		position: 'r.o. 4.3'
	};
	const citedBy: Row = { ...cites, direction: 'inbound', lid: null, position: 'r.o. 2.1' };

	it('names the judgment, not an article', () => {
		expect(columnLabel(column('lid'), 'judgments')).toBe('Plaats in deze uitspraak');
		expect(columnLabel(column('lid'), 'articles')).toBe('Plaats in dit artikel');
	});

	it('puts its own r.o. under the judgment and the lid it cites under the bron', () => {
		expect(column('lid').value(cites, ctx)).toBe('r.o. 4.3');
		expect(column('plaats').value(cites, ctx)).toBe('lid 2');
		expect(column('lid').value(citedBy, ctx)).toBe('');
		expect(column('plaats').value(citedBy, ctx)).toBe('r.o. 2.1');
	});
});

describe('exportRows', () => {
	const row = (key: string, extra: Partial<Row> = {}): Row => ({
		ref: { collection: 'judgments', key },
		title: key,
		context: null,
		filterGroup: 'uitspraken',
		...extra
	});
	const groups: Group[] = [
		{ id: 'procesgang', label: 'Procesgang', rows: [row('hof')], capped: false },
		{
			id: 'cited-by',
			label: 'Aangehaald in',
			rows: [
				row('hr', {
					mentions: [row('hr', { position: 'r.o. 2' }), row('hr', { position: 'r.o. 3' })]
				})
			],
			capped: false
		}
	];

	it('holds every group under the filter, and every mention as its own row', () => {
		expect(exportRows(groups, EMPTY_FILTER).map((r) => [r.title, r.position ?? null])).toEqual([
			['hof', null],
			['hr', 'r.o. 2'],
			['hr', 'r.o. 3']
		]);
		const none = { ...EMPTY_FILTER, bronnen: new Set(['dossiers'] as const) };
		expect(exportRows(groups, none)).toEqual([]);
	});

	it('says the part it exports where the rows loaded are fewer than the count', () => {
		expect(exportLabel(groups, EMPTY_FILTER)).toBe('Exporteer');
		const capped = [{ ...groups[1], total: 9065 }];
		expect(exportLabel(capped, EMPTY_FILTER)).toBe('Exporteer 1 van 9.065');
		for (const file of ['Verbonden.svelte', 'VerbondenTabel.svelte']) {
			const src = readFileSync(join(import.meta.dirname, file), 'utf8');
			expect(src, file).toContain('exportLabel(verbonden.groups, filter)');
		}
	});

	it('is what both Exporteer buttons export: the panel and the table give the same rows', () => {
		for (const file of ['Verbonden.svelte', 'VerbondenTabel.svelte']) {
			const src = readFileSync(join(import.meta.dirname, file), 'utf8');
			expect(src, file).toContain('exportRows(verbonden.groups, filter)');
			expect(src.match(/rowsToCsv\(/g), file).toHaveLength(1);
		}
	});

	it('leaves the table no columns of its own', () => {
		const src = readFileSync(join(import.meta.dirname, 'VerbondenTabel.svelte'), 'utf8');
		expect(src).not.toMatch(/const COLUMNS\b/);
	});
});
