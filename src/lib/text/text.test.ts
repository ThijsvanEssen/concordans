import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sr287 from '$lib/fixtures/article-bwbr0001854_287.json';
import sr47 from '$lib/fixtures/article-bwbr0001854_47.json';
import bw162 from '$lib/fixtures/article-bwbr0005289_162.json';
import sv359a from '$lib/fixtures/article-bwbr0001903_359a.json';
import sv67 from '$lib/fixtures/article-bwbr0001903_67.json';
import gw10 from '$lib/fixtures/article-bwbr0001840_10.json';
import hr1769 from '$lib/fixtures/judgment-hr-2024-1769.json';
import {
	markerOf,
	onderdeelMark,
	parseArticleParts,
	partsFromApi,
	partText,
	walkParts
} from './article-parts';
import { anchorOf, parseQualifier } from './qualifier';
import { findPassage } from './find-passage';

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

describe('markerOf', () => {
	it('puts the mark after a letter or a number, never after a dash', () => {
		expect(markerOf('a', '.')).toBe('a.');
		expect(markerOf('1°', '.')).toBe('1°.');
		expect(markerOf('b', ')')).toBe('b)');
		expect(markerOf('–', '.')).toBe('–');
	});
});

describe('parseQualifier', () => {
	it.each([
		['artikel 28, eerste lid Sv', '', 'lid-1'],
		['art. 27c lid 2 Sv', '', 'lid-2'],
		['artikel 6 lid 1 EVRM', '', 'lid-1'],
		['139d', ', eerste en tweede lid, 139g, 140, tweede lid', 'lid-1'],
		['artikel 416', ', tweede lid, van het Wetboek van Strafvordering', 'lid-2'],
		['artikel 7', ', eerste lid, onderdelen a en c, van de Wegenverkeerswet 1994', 'lid-1-onder-a'],
		['art. 359a lid 1 onder b Sv', '', 'lid-1-onder-b'],
		['artikel 47, eerste lid, onder 1°', '', 'lid-1-onder-1'],
		['artikel 1, aanhef en onder a', '', 'onder-a'],
		['artikel 3', ', aanhef, van de wet', 'aanhef']
	])('%s%s → %s', (span, following, anchor) => {
		expect(anchorOf(parseQualifier(span, following))).toBe(anchor);
	});

	it('does not take a qualifier that belongs to the next reference', () => {
		expect(parseQualifier('132', ', 138a, 138aa, 139d, eerste en tweede lid')).toBeNull();
		expect(parseQualifier('art. 359a Sv', ' en het tweede lid van art. 27 Sv')).toBeNull();
	});

	it('reads the spans of a real judgment', () => {
		const paragraph = hr1769.judgment.paragraphs[0];
		const found = paragraph.citations.map((c) =>
			anchorOf(parseQualifier(c.text ?? '', paragraph.text.slice(c.end!, c.end! + 80)))
		);
		expect(found).toContain('lid-2');
		expect(found).toContain(null);
	});
});

describe('findPassage', () => {
	const fixture = (name: string) => readFileSync(`src/lib/fixtures/${name}`, 'utf8');

	it('finds the heading of an article in the artikelsgewijze toelichting', () => {
		const text = fixture('mvt-36327-excerpt.txt');
		const passage = findPassage(text, '1.1.3');
		expect(passage?.derived).toBe(true);
		expect(text.slice(passage!.start, passage!.end)).toBe('Artikel 1.1.3 [onschuldpresumptie]');
	});

	it('does not take a sentence that starts with the article for a heading', () => {
		const text = fixture('mvt-36327-excerpt.txt');
		expect(findPassage(text, '17')).toBeNull();
		expect(findPassage(text, '1.1')).toBeNull();
	});

	it('finds a heading of the amending law that names the article', () => {
		const text = 'Algemeen\n  Artikel I, onderdeel C (artikel 287 Sr)\n  De wijziging ...';
		const passage = findPassage(text, '287');
		expect(text.slice(passage!.start, passage!.end)).toBe(
			'Artikel I, onderdeel C (artikel 287 Sr)'
		);
	});

	it('gives nothing when the toelichting is ordered by the amending law only', () => {
		expect(findPassage(fixture('mvt-36693-excerpt.txt'), '22b')).toBeNull();
	});
});

describe('onderdeelMark', () => {
	it('numbers an onderdeel a. in Dutch law and a) in EU law', () => {
		expect(onderdeelMark('BWBR0001854')).toBe('.');
		expect(onderdeelMark('32022R0868')).toBe(')');
		expect(onderdeelMark(null)).toBe('.');
	});
});
