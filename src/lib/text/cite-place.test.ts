import { describe, expect, it } from 'vitest';
import { citeArticle, partOfAnchor } from './cite';
import {
	parseArticleParts,
	partsFromApi,
	placeOf,
	walkParts,
	type ArticlePart
} from './article-parts';

// What a place's menu in the text offers: the citation of the place a click lands on.
const bw = (articleNumber: string, book: string) => ({
	articleNumber,
	shortTitle: `BW${book}`,
	citationTitle: `Burgerlijk Wetboek Boek ${book}`
});

const find = (parts: ArticlePart[], test: (p: ArticlePart) => boolean) =>
	[...walkParts(parts)].find(test)!;

const cite = (c: ReturnType<typeof bw>, parts: ArticlePart[], part: ArticlePart) =>
	citeArticle({ ...c, ...partOfAnchor(placeOf(parts, part)?.id ?? null) });

describe('citing a place in an article', () => {
	it('cites an article without leden as the article', () => {
		const text =
			'Het kind waarvan een vrouw zwanger is wordt als reeds geboren aangemerkt, zo dikwijls zijn belang dit vordert. Komt het dood ter wereld, dan wordt het geacht nooit te hebben bestaan.';
		const parts = parseArticleParts(text);
		expect(parts).toHaveLength(1);
		expect(placeOf(parts, parts[0])).toBeNull();
		const forms = cite(bw('2', '1'), parts, parts[0]);
		expect(forms.kort).toBe('art. 1:2 BW');
		expect(forms.voluit).toBe('artikel 1:2 van het Burgerlijk Wetboek');
	});

	it('cites every paragraph of an article without leden as the article', () => {
		const parts = parseArticleParts('Eerste alinea.\nTweede alinea.');
		expect(parts.map((p) => cite(bw('9', '1'), parts, p).kort)).toEqual([
			'art. 1:9 BW',
			'art. 1:9 BW'
		]);
	});

	it('cites a lid without onderdelen as the lid', () => {
		const parts = partsFromApi([
			{ id: 'lid-1', kind: 'lid', number: '1', start: 3, end: 164 },
			{ id: 'lid-2', kind: 'lid', number: '2', start: 168, end: 444 }
		]);
		const forms = cite(bw('162', '6'), parts, parts[1]);
		expect(forms.kort).toBe('art. 6:162 lid 2 BW');
		expect(forms.voluit).toBe('artikel 6:162, tweede lid, van het Burgerlijk Wetboek');
	});

	it('cites a lid with an aanhef and onderdelen as the lid, its aanhef and each onderdeel', () => {
		const api = partsFromApi([
			{ id: 'lid-1', kind: 'lid', number: '1', start: 3, end: 66 },
			{ id: 'lid-2', kind: 'lid', number: '2', start: 70, end: 419 },
			{ id: 'lid-2-aanhef', kind: 'aanhef', start: 70, end: 131 },
			{ id: 'lid-2-onder-a', kind: 'onderdeel', number: 'a', start: 135, end: 283 },
			{ id: 'lid-2-onder-b', kind: 'onderdeel', number: 'b', start: 287, end: 353 }
		]);
		const parsed = parseArticleParts(
			'1. Vermogensschade omvat zowel geleden verlies als gederfde winst.\n2. Als vermogensschade komen mede voor vergoeding in aanmerking:\na. redelijke kosten ter voorkoming;\nb. redelijke kosten ter vaststelling;\nmits redelijk.'
		);
		const c = bw('96', '6');
		for (const parts of [api, parsed]) {
			expect(
				cite(
					c,
					parts,
					find(parts, (p) => p.id === 'lid-2')
				).kort
			).toBe('art. 6:96 lid 2 BW');
			const a = cite(
				c,
				parts,
				find(parts, (p) => p.id === 'lid-2-onder-a')
			);
			expect(a.kort).toBe('art. 6:96 lid 2 onder a BW');
			expect(a.voluit).toBe('artikel 6:96, tweede lid, onderdeel a, van het Burgerlijk Wetboek');
		}
		const aanhef = cite(
			c,
			api,
			find(api, (p) => p.id === 'lid-2-aanhef')
		);
		expect(aanhef.kort).toBe('art. 6:96 lid 2 aanhef BW');
		expect(aanhef.voluit).toBe('artikel 6:96, tweede lid, aanhef, van het Burgerlijk Wetboek');
		// The closing words of a lid have no anchor of their own: they are the lid's.
		const slot = find(parsed, (p) => p.id === null);
		expect(cite(c, parsed, slot).kort).toBe('art. 6:96 lid 2 BW');
	});

	it('cites an article with an aanhef and onderdelen but no leden', () => {
		const text =
			'Het verzuim treedt zonder ingebrekestelling in:\na. wanneer een termijn verstrijkt;\nb. wanneer de verbintenis voortvloeit uit onrechtmatige daad;\nc. wanneer de schuldeiser moet afleiden dat de schuldenaar zal tekortschieten.';
		const parts = parseArticleParts(text);
		const c = bw('83', '6');
		expect(parts.map((p) => cite(c, parts, p).kort)).toEqual([
			'art. 6:83 aanhef BW',
			'art. 6:83 onder a BW',
			'art. 6:83 onder b BW',
			'art. 6:83 onder c BW'
		]);
		expect(cite(c, parts, parts[0]).voluit).toBe(
			'artikel 6:83, aanhef, van het Burgerlijk Wetboek'
		);
		expect(cite(c, parts, parts[2]).voluit).toBe(
			'artikel 6:83, onderdeel b, van het Burgerlijk Wetboek'
		);
	});
});
