import { describe, expect, it } from 'vitest';
import papers from '$lib/fixtures/paper-paragraphs.json';
import {
	paperParagraphAnchor,
	paperParagraphs,
	anchorLabel,
	atPlace,
	formatAnchor,
	lidAnchor,
	lidNumber,
	onderdeelAnchor,
	paragraphAnchor,
	paragraphNumber,
	parentAnchor,
	parseAnchor
} from './anchor';

describe('the anchors the API gives', () => {
	it.each([
		'rov-5.7.1',
		'alinea-4',
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
		for (const id of ['', 'p-12', 'alinea-0', 'alinea-4a', 'lid', 'onder-a-lid-2', 'aanhef-lid-2'])
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

describe('the alineas of a Kamerstuk: its text alone, numbered from 1 (A32 #1)', () => {
	const numbered = (doc: (typeof papers)[keyof typeof papers]) =>
		paperParagraphs(doc).filter((p) => p.n !== null);
	const own = (doc: (typeof papers)[keyof typeof papers]) =>
		paperParagraphs(doc)
			.filter((p) => p.n === null)
			.map((p) => p.text);

	it('leaves out the head of a motie and its closing, by the dictum the API gives', () => {
		const motie = papers['motie-37020-XVI-57'];
		const a = numbered(motie);
		expect(a[0]).toMatchObject({ n: 1, text: expect.stringMatching(/^constaterende dat/) });
		expect(a.at(-1)).toMatchObject({ n: 5, text: expect.stringMatching(/^verzoekt de regering/) });
		expect(own(motie).slice(0, 3)).toEqual([
			'MOTIE VAN HET LID TIJMSTRA C.S.',
			'De Kamer,',
			'gehoord de beraadslaging,'
		]);
		expect(own(motie)).toContain('en gaat over tot de orde van de dag.');
	});

	it('leaves out the head of a memorie and its headings (sections)', () => {
		const a = numbered(papers['mvt-37020-I-2']);
		expect(a[0]).toMatchObject({ n: 1, text: expect.stringMatching(/^De begrotingsstaten/) });
		expect(a.map((p) => p.text)).not.toContain('1. Leeswijzer');
	});

	it('leaves out the onderdelen A, B, C of a nota van wijziging, keeps its opening sentence', () => {
		const nota = papers['nota-36808-6'];
		const a = numbered(nota);
		expect(a[0]).toMatchObject({ n: 1, text: 'Het voorstel (nr. 2) wordt als volgt gewijzigd:' });
		expect(a[1]).toMatchObject({ n: 2, text: expect.stringMatching(/^Aan het opschrift/) });
		expect(own(nota)).toEqual(expect.arrayContaining(['TWEEDE NOTA VAN WIJZIGING', 'A', 'B', 'C']));
	});

	it('keeps every line in the order of the text, where its words start', () => {
		for (const doc of Object.values(papers)) {
			const all = paperParagraphs(doc);
			all.forEach((p, i) => {
				expect(p.i).toBe(i);
				expect(doc.text.slice(p.start, p.start + p.text.length)).toBe(p.text);
			});
		}
	});

	it('names an alinea by its number: `alinea-4`', () => {
		expect(paperParagraphAnchor(4)).toBe('alinea-4');
		expect(parseAnchor('alinea-4')).toEqual({ kind: 'alinea', number: 4 });
		expect(paperParagraphs({ text: null })).toEqual([]);
	});

	it('prints an alinea as a citation names it', () => {
		expect(anchorLabel('alinea-12')).toBe('alinea 12');
	});

	it('reads a section of a paper (`s-300`), a passage as the API gives it, by its id', () => {
		expect(parseAnchor('s-300')).toEqual({ kind: 'section', id: 's-300' });
		expect(parseAnchor('s-x')).toBeNull();
		// Its heading is the paper's, not the anchor's: the anchor alone prints nothing.
		expect(anchorLabel('s-300')).toBeNull();
	});
});
