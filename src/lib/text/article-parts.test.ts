import { describe, expect, it } from 'vitest';
import sr287 from '$lib/fixtures/article-bwbr0001854_287.json';
import sr47 from '$lib/fixtures/article-bwbr0001854_47.json';
import bw162 from '$lib/fixtures/article-bwbr0005289_162.json';
import sv359a from '$lib/fixtures/article-bwbr0001903_359a.json';
import sv67 from '$lib/fixtures/article-bwbr0001903_67.json';
import gw10 from '$lib/fixtures/article-bwbr0001840_10.json';
import {
	markerOf,
	onderdeelMark,
	parseArticleParts,
	partsFromApi,
	partsOf,
	partText,
	walkParts
} from './article-parts';

const ids = (text: string) => [...walkParts(parseArticleParts(text))].map((p) => p.id);

describe('parseArticleParts', () => {
	it('leaves an article without leden as one text', () => {
		const parts = parseArticleParts(sr287.article.text);
		expect(parts).toHaveLength(1);
		expect(parts[0]).toMatchObject({ kind: 'tekst', id: null, start: 0 });
	});

	it('finds the leden of BW 6:162 and Grondwet 10', () => {
		expect(ids(bw162.article.text)).toEqual(['lid-1', 'lid-2', 'lid-3']);
		expect(ids(gw10.article.text).slice(0, 3)).toEqual(['lid-1', 'lid-2', 'lid-3']);
	});

	it('nests the onderdelen of Sv 359a under the first lid', () => {
		const text = sv359a.article.text;
		const [first, second] = parseArticleParts(text);
		expect(first.children.map((c) => c.id)).toEqual([
			'lid-1-onder-a',
			'lid-1-onder-b',
			'lid-1-onder-c'
		]);
		expect(text.slice(first.textStart, first.textEnd).trim()).toMatch(
			/^De rechtbank kan.*bepalen dat:$/
		);
		expect(second.id).toBe('lid-2');
		expect(partText(text, [first, second], 'lid-1-onder-b')).toMatch(/^b\. de resultaten/);
	});

	it('reads 1° and 2° in Sr 47 as onderdelen, and the 2. after them as the second lid', () => {
		expect(ids(sr47.article.text)).toEqual(['lid-1', 'lid-1-onder-1', 'lid-1-onder-2', 'lid-2']);
	});

	it('keeps offsets into the article text, so citation spans still fit', () => {
		const text = sv67.article.text;
		const parts = [...walkParts(parseArticleParts(text))];
		for (const part of parts) {
			expect(part.start).toBeLessThanOrEqual(part.textStart);
			expect(part.textEnd).toBeLessThanOrEqual(part.end);
			if (part.number) expect(text.slice(part.start).startsWith(part.number)).toBe(true);
		}
		const span = sv67.citations[0];
		const holder = parts.findLast((p) => p.textStart <= span.start! && span.end! <= p.textEnd);
		expect(holder?.id).toBe('lid-1-onder-b');
		expect(text.slice(span.start!, span.end!)).toBe(span.text);
	});

	// Cbw 1: definitions in a dash list, one with a list of its own, one going on indented.
	const cbw1 = [
		'In deze wet wordt verstaan onder:',
		'– belangrijke entiteit: een entiteit als bedoeld in artikel 12 of 13;',
		'– CER-richtlijn:',
		'        Richtlijn (EU) 2022/2557;',
		'– netwerk- en informatiesysteem:',
		'a. een elektronisch communicatienetwerk; of',
		'b. elk apparaat; of',
		'c. digitale gegevens;',
		'– NIS2-richtlijn: Richtlijn (EU) 2022/2555;'
	].join('\n');

	it('reads a dash as an onderdeel, with the a., b. and c. under it nested', () => {
		const parts = parseArticleParts(cbw1);
		expect(parts.map((p) => [p.id, p.number])).toEqual([
			['aanhef', null],
			['onder-_1', '–'],
			['onder-_2', '–'],
			['onder-_3', '–'],
			['onder-_4', '–']
		]);
		const [, , cer, nis] = parts;
		expect(cbw1.slice(cer.textStart, cer.textEnd)).toMatch(/^CER-richtlijn:\n\s+Richtlijn/);
		expect(nis.children.map((c) => c.id)).toEqual([
			'onder-_3-onder-a',
			'onder-_3-onder-b',
			'onder-_3-onder-c'
		]);
		expect(cbw1.slice(nis.textStart, nis.textEnd).trim()).toBe('netwerk- en informatiesysteem:');
		expect(partText(cbw1, parts, 'onder-_3-onder-b')).toBe('b. elk apparaat; of');
	});

	it('returns nothing for an article without text', () => {
		expect(parseArticleParts(null)).toEqual([]);
	});
});

describe('partsFromApi', () => {
	// BW 7:3 lid 3: the lid and its aanhef start at the same offset.
	const part = (id: string, kind: string, number: string | null, start: number, end: number) => ({
		id,
		kind,
		number,
		text: '',
		start,
		end
	});

	it('nests the aanhef of a lid under that lid', () => {
		const roots = partsFromApi([
			part('lid-2', 'lid', '2', 633, 816),
			part('lid-3', 'lid', '3', 820, 2277),
			part('lid-3-aanhef', 'aanhef', null, 820, 892),
			part('lid-3-onder-a', 'onderdeel', 'a', 896, 1376),
			part('lid-4', 'lid', '4', 2281, 2566)
		]);
		expect(roots.map((p) => p.id)).toEqual(['lid-2', 'lid-3', 'lid-4']);
		expect(roots[1].children.map((p) => p.id)).toEqual(['lid-3-aanhef', 'lid-3-onder-a']);
		expect(new Set(roots.map((p) => p.start)).size).toBe(roots.length);
	});
});

describe('partsFromApi with the text', () => {
	// Cbw 1 as the API gives it: the dash has no aanhef of its own, its a. starts after "a. ".
	const text = 'Onder:\n– netwerk:\na. een netwerk; of\nb. een apparaat;';
	const at = (s: string) => text.indexOf(s);
	const roots = partsFromApi(
		[
			{ id: 'aanhef', kind: 'aanhef', number: null, start: 0, end: 6 },
			{
				id: 'onder-_1',
				kind: 'onderdeel',
				number: '–',
				term: 'netwerk',
				start: at('netwerk:'),
				end: text.length
			},
			{
				id: 'onder-_1-onder-a',
				kind: 'onderdeel',
				number: 'a',
				start: at('een netwerk'),
				end: at('een netwerk') + 15
			},
			{
				id: 'onder-_1-onder-b',
				kind: 'onderdeel',
				number: 'b',
				start: at('een apparaat'),
				end: text.length
			}
		],
		text
	);

	it('nests the a. and b. under the dash, and ends its own text before their number', () => {
		expect(roots.map((p) => p.id)).toEqual(['aanhef', 'onder-_1']);
		const dash = roots[1];
		expect(dash.children.map((p) => p.id)).toEqual(['onder-_1-onder-a', 'onder-_1-onder-b']);
		expect(text.slice(dash.textStart, dash.textEnd).trim()).toBe('netwerk:');
		// The term the dash defines comes with it; its a. and b. define none.
		expect([dash.term, ...dash.children.map((p) => p.term)]).toEqual(['netwerk', null, null]);
	});
});

describe('partsOf with the parts of the API', () => {
	// BW 6:177 as the API gives it: each part starts after its number ("1. ", "b. ").
	const text =
		'1. De exploitant is aansprakelijk door:\na. uitstroming;\nb. beweging van de bodem.';
	const at = (s: string) => text.indexOf(s);
	const parts = partsOf(text, [
		{ id: 'lid-1', kind: 'lid', number: '1', start: 3, end: text.length },
		{ id: 'lid-1-aanhef', kind: 'aanhef', number: null, start: 3, end: at('\na.') },
		{
			id: 'lid-1-onder-a',
			kind: 'onderdeel',
			number: 'a',
			start: at('uitstroming'),
			end: at('\nb.')
		},
		{ id: 'lid-1-onder-b', kind: 'onderdeel', number: 'b', start: at('beweging'), end: text.length }
	]);

	it('cites a part with its number in front, as the source prints it', () => {
		expect(partText(text, parts, 'lid-1-onder-b')).toBe('b. beweging van de bodem.');
		expect(partText(text, parts, 'lid-1')).toBe(text);
		expect(partText(text, parts, 'lid-1-aanhef')).toBe('De exploitant is aansprakelijk door:');
	});

	it('keeps the own text of a part after its number', () => {
		const b = parts[0].children[2];
		expect(text.slice(b.textStart, b.textEnd)).toBe('beweging van de bodem.');
	});
});

describe('markerOf', () => {
	it('puts the mark after a letter or a number, never after a dash', () => {
		expect(markerOf('a', '.')).toBe('a.');
		expect(markerOf('1°', '.')).toBe('1°.');
		expect(markerOf('b', ')')).toBe('b)');
		expect(markerOf('–', '.')).toBe('–');
	});
});

describe('onderdeelMark', () => {
	it('numbers an onderdeel a. in Dutch law and a) in EU law', () => {
		expect(onderdeelMark('BWBR0001854')).toBe('.');
		expect(onderdeelMark('32022R0868')).toBe(')');
		expect(onderdeelMark(null)).toBe('.');
	});
});
