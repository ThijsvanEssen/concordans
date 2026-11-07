import { describe, expect, it } from 'vitest';
import { aliasRow, suggest, suggestionsOf } from './aliases.svelte';

const data = {
	codes: [
		{ abbreviation: 'Awb', law_id: 'BWBR0005537' },
		{ abbreviation: 'Awr', law_id: 'BWBR0002320' },
		{ abbreviation: 'BW 7', law_id: 'BWBR0005290' },
		{ abbreviation: 'Sr', law_id: 'BWBR0001854' },
		{ abbreviation: 'sr', law_id: 'BWBR0001854' }
	],
	families: { BW: { '7': 'BWBR0005290' } },
	names: { BW: ['Burgerlijk Wetboek'] }
};
const all = suggestionsOf(data);
const abbreviations = (line: string) => suggest(all, line).map((s) => s.abbreviation);

describe('abbreviation suggestions', () => {
	it('keeps one word each, once', () => {
		expect(all.map((s) => s.abbreviation)).toEqual(['BW', 'Awb', 'Awr', 'Sr']);
	});
	it('offers those a line begins, in any case, shortest first', () => {
		expect(abbreviations('a')).toEqual(['Awb', 'Awr']);
		expect(abbreviations('aw')).toEqual(['Awb', 'Awr']);
		expect(abbreviations('b')).toEqual(['BW']);
	});
	it('offers none for the whole abbreviation, an empty line or several words', () => {
		expect(abbreviations('Awb')).toEqual([]);
		expect(abbreviations('')).toEqual([]);
		expect(abbreviations('BW 7')).toEqual([]);
	});
	it('names a code by its first name and waits for its book', () => {
		const row = aliasRow(suggest(all, 'B')[0]);
		expect(row).toMatchObject({
			label: 'BW',
			word: 'Burgerlijk Wetboek',
			fill: 'BW ',
			suggest: true
		});
		expect(aliasRow(suggest(all, 'Aw')[0]).fill).toBe('Awb');
	});
});
