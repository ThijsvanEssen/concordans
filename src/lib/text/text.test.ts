import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sr287 from '$lib/fixtures/article-bwbr0001854_287.json';
import sr47 from '$lib/fixtures/article-bwbr0001854_47.json';
import bw162 from '$lib/fixtures/article-bwbr0005289_162.json';
import sv359a from '$lib/fixtures/article-bwbr0001903_359a.json';
import sv67 from '$lib/fixtures/article-bwbr0001903_67.json';
import gw10 from '$lib/fixtures/article-bwbr0001840_10.json';
import hr1769 from '$lib/fixtures/judgment-hr-2024-1769.json';
import { parseArticleParts, partText, walkParts } from './article-parts';
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

	it('returns nothing for an article without text', () => {
		expect(parseArticleParts(null)).toEqual([]);
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
