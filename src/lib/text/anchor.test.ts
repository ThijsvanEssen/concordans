import { describe, expect, it } from 'vitest';
import papers from '$lib/fixtures/paper-paragraphs-api.json';
import paper33478 from '$lib/fixtures/paper-kst-33478-3-tables.json';
import { rowsOf, type Table } from './tables';
import {
	paperBlocks,
	paperParagraphs,
	type PaperSource,
	anchorLabel,
	atPlace,
	formatAnchor,
	lidAnchor,
	lidNumber,
	numeralOf,
	onderdeelAnchor,
	paragraphAnchor,
	paragraphNumber,
	parentAnchor,
	parseAnchor
} from './anchor';

describe('the anchors the API gives', () => {
	it.each([
		'rov-5.7.1',
		'p-360a090c',
		'p-360a090c_2',
		's-300',
		'lid-2',
		'lid-2-onder-a',
		'lid-1-onder-d-onder-i',
		'lid-3-aanhef',
		'aanhef',
		'onder-q_2',
		'onder-_39-onder-a',
		'tekst-6-onder-a',
		'fn-35-2',
		'artikel-658',
		'deel-hoofdstuk-3'
	])('reads and writes %s alike', (id) => {
		const anchor = parseAnchor(id);
		expect(anchor).not.toBeNull();
		expect(formatAnchor(anchor!)).toBe(id);
	});

	it('reads what each anchor names', () => {
		expect(parseAnchor('rov-5.1')).toEqual({ kind: 'paragraph', number: '5.1' });
		expect(parseAnchor('fn-35-2')).toEqual({ kind: 'note', label: '35-2' });
		expect(parseAnchor('lid-2-onder-a')).toEqual({
			kind: 'part',
			lid: '2',
			text: null,
			onderdelen: ['a'],
			aanhef: false
		});
	});

	it('reads no anchor from what is none', () => {
		for (const id of ['', 'p-12', 'p-360a090g', 'alinea-4', 'lid', 'onder-a-lid-2', 'aanhef-lid-2'])
			expect(parseAnchor(id)).toBeNull();
	});

	it('names the part a part stands in', () => {
		expect(parentAnchor('lid-3-onder-a')).toBe('lid-3');
		expect(parentAnchor('lid-3-aanhef')).toBe('lid-3');
		expect(parentAnchor('onder-_39-onder-a')).toBe('onder-_39');
		expect(parentAnchor('lid-3')).toBeNull();
		expect(parentAnchor('rov-5.1')).toBeNull();
	});
});

describe('anchorLabel', () => {
	it('prints a part as the reader does', () => {
		expect(anchorLabel('lid-2')).toBe('lid 2');
		expect(anchorLabel('lid-2-onder-a')).toBe('lid 2, onder a');
		expect(anchorLabel('lid-1-onder-d-onder-i')).toBe('lid 1, onder d sub i');
		expect(anchorLabel('onder-q_2')).toBe('onder q');
		expect(anchorLabel('lid-3-aanhef')).toBe('lid 3 aanhef');
	});

	it('cites an overweging as its judgment does', () => {
		expect(anchorLabel('rov-5.1')).toBe('r.o. 5.1');
		expect(anchorLabel('rov-5.1', 'ECLI:NL:HR:2019:2006')).toBe('r.o. 5.1');
		expect(anchorLabel('rov-5', 'ECLI:NL:PHR:2020:453')).toBe('onder 5');
		expect(anchorLabel('rov-5', 'judgments/ecli_nl_phr_2020_453')).toBe('onder 5');
		expect(anchorLabel('rov-5', 'ECLI:EU:C:2019:1')).toBe('punt 5');
	});

	it('names no place for an anchor it cannot print', () => {
		expect(anchorLabel('p-12')).toBeNull();
		expect(anchorLabel('deel-hoofdstuk-3')).toBeNull();
		expect(anchorLabel('onder-_39')).toBeNull();
		expect(anchorLabel('onder-_39-onder-a')).toBe('onder a');
	});
});

describe('atPlace', () => {
	it('puts "in" before a place, and nothing before one that is its own preposition (#66)', () => {
		expect(atPlace('r.o. 4.3 en 5.1')).toBe('in r.o. 4.3 en 5.1');
		expect(atPlace('§ 5')).toBe('in § 5');
		expect(atPlace('voetnoot 3')).toBe('in voetnoot 3');
		expect(atPlace(anchorLabel('rov-3', 'ECLI:NL:PHR:2026:901')!)).toBe('onder 3');
		expect(atPlace(anchorLabel('onder-a')!)).toBe('onder a');
	});
});

describe('the anchors a reader builds', () => {
	it('names an overweging by its number, and the number by the anchor', () => {
		expect(paragraphAnchor('5.7.1')).toBe('rov-5.7.1');
		expect(paragraphNumber('rov-5.7.1')).toBe('5.7.1');
		for (const id of ['p-3f2a9c1e', 'lid-2', 'fn-35', '', null, undefined])
			expect(paragraphNumber(id)).toBeNull();
	});

	it('names a lid, and an onderdeel in what it stands in', () => {
		expect(lidAnchor('2')).toBe('lid-2');
		expect(lidNumber('lid-4')).toBe('4');
		for (const id of ['lid-2-onder-a', 'lid-3-aanhef', 'onder-a', 'tekst-6', 'rov-4', '', null])
			expect(lidNumber(id)).toBeNull();
		expect(onderdeelAnchor(null, 'a')).toBe('onder-a');
		expect(onderdeelAnchor('lid-2', 'a')).toBe('lid-2-onder-a');
		expect(onderdeelAnchor('onder-_39', 'a')).toBe('onder-_39-onder-a');
		expect(onderdeelAnchor('lid-1-onder-d', 'i')).toBe('lid-1-onder-d-onder-i');
	});
});

describe('the alineas of a Kamerstuk, as the API numbers them (A28, #821)', () => {
	type Paper = (typeof papers)[keyof typeof papers];
	const numbered = (doc: Paper) => paperParagraphs(doc).filter((p) => p.n !== null);

	it('takes the number and the lasting id of each line from the API, and counts nothing itself', () => {
		const motie = papers['kst_37020_57'];
		const lines = paperParagraphs(motie);
		const a = numbered(motie);
		expect(a.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(a[0].text).toMatch(/^constaterende dat/);
		// The anchor of an alinea is the id of its line, as the API gives it.
		const api = motie.paragraphs.find((p) => p.number === 1)!;
		expect(a[0]).toMatchObject({ at: api.id, first: true });
		expect(lines.filter((p) => p.n === null).map((p) => p.at)).toEqual(
			lines.filter((p) => p.n === null).map(() => null)
		);
	});

	it('makes a table one alinea: its lines one number, one anchor, the first its marker', () => {
		const mvt = papers['kst_37020_i_2'];
		const table = paperParagraphs(mvt).filter((p) => p.text.startsWith('Tabel 1 Belangrijkste'))[0];
		const rows = paperParagraphs(mvt).filter((p) => p.n === table.n);
		expect(rows.length).toBe(15);
		expect(new Set(rows.map((p) => p.at))).toEqual(new Set([table.at]));
		expect(rows.filter((p) => p.first)).toEqual([table]);
	});

	it('keeps every line of the text where its words start, its place among the lines `i`', () => {
		for (const doc of Object.values(papers)) {
			const all = paperParagraphs(doc);
			all.forEach((p, i) => {
				expect(p.i).toBe(i);
				expect(doc.text.slice(p.start, p.start + p.text.length)).toBe(p.text);
			});
		}
	});

	it('numbers nothing in a paper the API has not numbered yet: no alinea, no anchor', () => {
		const { text } = papers['kst_37020_57'];
		const lines = paperParagraphs({ text, paragraphs: [] });
		expect(lines.length).toBeGreaterThan(5);
		expect(lines.every((p) => p.n === null && p.at === null)).toBe(true);
		// The API before 0.79.66 sends no `paragraphs` at all: read as none.
		expect(paperParagraphs({ text })).toEqual(lines);
		expect(paperParagraphs({ text: null })).toEqual([]);
	});

	it('reads the anchor of a line, as a judgment names an unnumbered paragraph', () => {
		expect(parseAnchor('p-360a090c')).toEqual({ kind: 'line', id: 'p-360a090c' });
		expect(parseAnchor('p-360a090c_2')).toEqual({ kind: 'line', id: 'p-360a090c_2' });
		expect(parseAnchor('alinea-4')).toBeNull();
		// Its number is the paper's: the anchor alone prints nothing.
		expect(anchorLabel('p-360a090c')).toBeNull();
	});

	it('reads a section of a paper (`s-300`), a passage as the API gives it, by its id', () => {
		expect(parseAnchor('s-300')).toEqual({ kind: 'section', id: 's-300' });
		expect(parseAnchor('s-x')).toBeNull();
		// A lasting id (#831): `s-` and 8 hex of its heading and the line after it.
		expect(parseAnchor('s-3f2a9c1e')).toEqual({ kind: 'section', id: 's-3f2a9c1e' });
		expect(parseAnchor('s-3f2a9c1e_2')).toEqual({ kind: 'section', id: 's-3f2a9c1e_2' });
		// Its heading is the paper's, not the anchor's: the anchor alone prints nothing.
		expect(anchorLabel('s-300')).toBeNull();
	});
});

describe('the blocks of a Kamerstuk: an alinea with a table one block (A55, API #818)', () => {
	// kst-33478-3 as the API gives it: a transposition table at its end, alinea 48, whose first
	// cell spans two rows.
	const doc = paper33478 as unknown as PaperSource & { text: string; tables: Table[] };
	const lines = paperParagraphs(doc);
	const blocks = paperBlocks(lines, doc);

	it('makes the lines of the table one block, its alinea marked on the first', () => {
		const withTable = blocks.filter((b) => b.tables.length);
		expect(withTable).toHaveLength(1);
		const [b] = withTable;
		expect(b.line).toMatchObject({ n: 48, first: true });
		expect(new Set(b.lines.map((l) => l.at))).toEqual(new Set([b.line.at]));
		expect(b.lines.length).toBe(lines.filter((l) => l.n === 48).length);
		const rows = rowsOf(b.text, b.tables[0]).map((r) =>
			r.cells.map((c) => b.text.slice(c.start, c.end))
		);
		expect(rows[0][0]).toBe('I. 1');
		expect(rows[0][2]).toBe('Algemeen van aard.');
		expect(rows[1]).toHaveLength(2);
		expect(rowsOf(b.text, b.tables[0])[0].cells[0].rowspan).toBe(2);
	});

	it('leaves every other line a block of its own', () => {
		expect(blocks.length).toBe(
			lines.length - blocks.find((b) => b.tables.length)!.lines.length + 1
		);
		expect(paperBlocks(lines, { ...doc, tables: [] })).toHaveLength(lines.length);
	});

	it('takes the title of a table into its block, and the empty cells at the edge of a row', () => {
		const text = 'Inleiding.\nTabel 1 Uitgaven\n\tA\tB\nx\t1\t\n';
		const start = text.indexOf('\tA');
		const table: Table = { start, end: text.length - 1, head_rows: 1, columns: 3, spans: [] };
		const paragraphs = [
			{ id: 'p-00000001', number: 1, char_start: 0, char_end: 10 },
			{ id: 'p-00000002', number: 2, char_start: 11, char_end: start - 1 },
			{ id: 'p-00000003', number: 2, char_start: start, char_end: text.indexOf('\nx') },
			{ id: 'p-00000004', number: 2, char_start: text.indexOf('x'), char_end: text.length - 1 }
		];
		const source = { text, paragraphs, tables: [table] };
		const [eerste, tweede] = paperBlocks(paperParagraphs(source), source);
		expect(eerste.tables).toEqual([]);
		expect(tweede.text).toBe('Tabel 1 Uitgaven\n\tA\tB\nx\t1\t');
		expect(
			rowsOf(tweede.text, tweede.tables[0]).map((r) =>
				r.cells.map((c) => tweede.text.slice(c.start, c.end))
			)
		).toEqual([
			['', 'A', 'B'],
			['x', '1', '']
		]);
	});
});

describe('a question and its answer: the number and the label on a line of their own (A213)', () => {
	// kst-29893-283 and kst-36942-6 as the API gives them: `16.` a paragraph of its own, the
	// question after it, then the answer, with `Antwoord` a line of its own in a nota.
	const lines = [
		'Inleiding.',
		'16.',
		'Hoe borgt u dit?',
		'Het wordt geborgd.',
		'17.',
		'Hoe dan?',
		'Antwoord',
		'Zo.'
	];
	const paperOf = (rows: string[], sections: { heading: string; char_start: number }[] = []) => {
		const text = rows.join('\n');
		let at = 0;
		const paragraphs = rows.map((r, i) => {
			const p = { id: `p-0000000${i}`, number: i + 1, char_start: at, char_end: at + r.length };
			at += r.length + 1;
			return p;
		});
		return { text, paragraphs, sections };
	};

	it('hangs the number on its question, which the label of the source after it marks as one', () => {
		const doc = paperOf(lines);
		const blocks = paperBlocks(paperParagraphs(doc), doc);
		expect(blocks.map((b) => b.line.text)).toEqual([
			'Inleiding.',
			'Hoe borgt u dit?',
			'Het wordt geborgd.',
			'Hoe dan?',
			'Zo.'
		]);
		expect(blocks[1]).toMatchObject({ numeral: { text: '16.', id: 'p-00000001' }, question: true });
		expect(blocks[2]).toMatchObject({ numeral: null, answerLabel: null, question: false });
		expect(blocks[3]).toMatchObject({ numeral: { text: '17.' }, question: true });
		expect(blocks[4]).toMatchObject({ answerLabel: { text: 'Antwoord' }, question: false });
		// Offsets and lines are the API's: the question is still found where it stands.
		expect(blocks[1].start).toBe(doc.text.indexOf('Hoe borgt'));
	});

	it('takes "Vraag 4" as the number 4 and "Antwoord op vraag 4" as the label of its answer', () => {
		expect(numeralOf('Vraag 4')).toBe('4');
		expect(numeralOf('16.')).toBe('16.');
		expect(numeralOf('Vraag 4 en 5')).toBeNull();
		const doc = paperOf(['Vraag 4', 'Wat?', 'Antwoord op vraag 4', 'Dat.']);
		const [first, second] = paperBlocks(paperParagraphs(doc), doc);
		expect(first).toMatchObject({ question: true });
		expect(second.answerLabel?.text).toBe('Antwoord op vraag 4');
	});

	it('leaves a number before a heading, a table or the end where it is', () => {
		const doc = paperOf(['Tekst.', '5.', '6. Kop'], [{ heading: '6. Kop', char_start: 10 }]);
		expect(paperBlocks(paperParagraphs(doc), doc).map((b) => b.line.text)).toEqual([
			'Tekst.',
			'5.',
			'6. Kop'
		]);
		const ending = paperOf(['Tekst.', '5.']);
		expect(paperBlocks(paperParagraphs(ending), ending)).toHaveLength(2);
	});
});
