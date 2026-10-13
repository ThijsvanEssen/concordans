import { describe, expect, it } from 'vitest';
import {
	begrippenWithin,
	definitieKaart,
	definitieRegel,
	definitiesOp,
	plaatsVan,
	type Definitie
} from './begrippen';

const wet: Definitie = {
	ref: 'bwbr0018450_1#a',
	term: 'wet',
	text: 'de Zorgverzekeringswet',
	article_key: 'bwbr0018450_1',
	article_number: '1',
	place: 'a',
	refers_to: 'BWBR0018450'
};

describe('begrippen', () => {
	it('says a definition in one line, as the hover has it', () => {
		expect(definitieRegel(wet)).toBe('wet: de Zorgverzekeringswet (art. 1, onder a)');
		expect(plaatsVan({ article_number: '1', place: null })).toBe('art. 1');
		expect(plaatsVan({ article_number: null, place: 'a' })).toBeNull();
		// A dash or bullet of the list is no place: the article alone.
		for (const teken of ['–', '−', '•', '○', ' - '])
			expect(plaatsVan({ article_number: '1', place: teken })).toBe('art. 1');
		expect(plaatsVan({ article_number: '1', place: '2°' })).toBe('art. 1, onder 2°');
	});

	it('makes the card of a term: its place, the term, the definition', () => {
		expect(definitieKaart(wet)).toEqual({
			kicker: 'Begrip, art. 1, onder a',
			title: 'wet',
			date: null,
			lines: 'de Zorgverzekeringswet'
		});
	});

	it('takes the terms of one part, with offsets in it', () => {
		const spans = [
			{ start: 10, end: 13, term: 'wet', definition_ref: wet.ref },
			{ start: 60, end: 63, term: 'wet', definition_ref: wet.ref }
		];
		expect(begrippenWithin(spans, 5, 40)).toEqual([
			{ start: 5, end: 8, term: 'wet', definition_ref: wet.ref }
		]);
		expect(definitiesOp([wet]).get(wet.ref)?.term).toBe('wet');
		expect(definitiesOp(null).size).toBe(0);
	});
});
