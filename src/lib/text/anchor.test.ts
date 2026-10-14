import { describe, expect, it } from 'vitest';
import {
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
		for (const id of ['', 'p-12', 'lid', 'onder-a-lid-2', 'aanhef-lid-2'])
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
		expect(anchorLabel('rov-5', 'ECLI:EU:C:2019:1')).toBe('§ 5');
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
