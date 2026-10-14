import { describe, expect, it } from 'vitest';
import { anchorLabel, formatAnchor, parentAnchor, parseAnchor } from './anchor';

describe('the anchors the API gives', () => {
	it.each([
		'rov-5.7.1',
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
		for (const id of ['', 'p-12', 'lid', 'onder-a-lid-2', 'aanhef-lid-2']) expect(parseAnchor(id)).toBeNull();
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
		expect(anchorLabel('rov-5', 'ECLI:EU:C:2019:1')).toBe('§ 5');
	});

	it('names no place for an anchor it cannot print', () => {
		expect(anchorLabel('p-12')).toBeNull();
		expect(anchorLabel('deel-hoofdstuk-3')).toBeNull();
		expect(anchorLabel('onder-_39')).toBeNull();
		expect(anchorLabel('onder-_39-onder-a')).toBe('onder a');
	});
});
