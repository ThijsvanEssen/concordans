import { describe, expect, it } from 'vitest';
import { articleCitation, citeArticle, citePublication, partOfAnchor, placeCitation } from './cite';
import { ordinalWord } from './getal';
import { BW_BOOKS } from './bw';
import {
	parseArticleParts,
	partsFromApi,
	placeOf,
	walkParts,
	type ArticlePart
} from './article-parts';

describe('citeArticle', () => {
	const base = { articleNumber: '300', shortTitle: 'Sr', citationTitle: 'Wetboek van Strafrecht' };

	it('cites a lid in the short, the long and the dated form', () => {
		const forms = citeArticle({ ...base, lid: '2', date: new Date(2026, 8, 22) });
		expect(forms.short).toBe('art. 300 lid 2 Sr');
		expect(forms.full).toBe('artikel 300, tweede lid, van het Wetboek van Strafrecht');
		expect(forms.dated).toBe('art. 300 lid 2 Sr (tekst geldend op 22 september 2026)');
	});

	it('cites an onderdeel inside a lid, and an article without a short title', () => {
		expect(citeArticle({ ...base, lid: '2', onderdelen: ['a'] }).short).toBe(
			'art. 300 lid 2 onder a Sr'
		);
		expect(citeArticle({ ...base, lid: '2', onderdelen: ['a'] }).full).toBe(
			'artikel 300, tweede lid, onderdeel a, van het Wetboek van Strafrecht'
		);
		expect(citeArticle({ ...base, shortTitle: null }).short).toBe(
			'art. 300 Wetboek van Strafrecht'
		);
		expect(citeArticle(base).full).toBe('artikel 300 van het Wetboek van Strafrecht');
	});

	it('cites an onderdeel of an onderdeel, and the aanhef of a lid', () => {
		const forms = citeArticle({ ...base, articleNumber: '5', lid: '1', onderdelen: ['d', 'i'] });
		expect(forms.short).toBe('art. 5 lid 1 onder d sub i Sr');
		expect(forms.full).toBe(
			'artikel 5, eerste lid, onderdeel d, onder i, van het Wetboek van Strafrecht'
		);
		expect(citeArticle({ ...base, lid: '3', aanhef: true }).short).toBe('art. 300 lid 3 aanhef Sr');
	});

	it('puts the book of the Burgerlijk Wetboek before the article', () => {
		const bw7 = {
			bwbId: 'BWBR0005290',
			articleNumber: '3',
			shortTitle: 'BW',
			citationTitle: 'Burgerlijk Wetboek Boek 7'
		};
		expect(citeArticle({ ...bw7, lid: '3', onderdelen: ['a'] }).short).toBe(
			'art. 7:3 lid 3 onder a BW'
		);
		expect(citeArticle(bw7).full).toBe('artikel 7:3 van het Burgerlijk Wetboek');
		// The API names the book itself `BW6`; the citation names the code.
		expect(
			citeArticle({
				bwbId: 'BWBR0005289',
				articleNumber: '162',
				shortTitle: 'BW6',
				citationTitle: 'Burgerlijk Wetboek Boek 6'
			}).short
		).toBe('art. 6:162 BW');
		const bw7a = {
			bwbId: 'BWBR0006000',
			articleNumber: '1576',
			shortTitle: 'BW7A',
			citationTitle: 'Burgerlijk Wetboek Boek 7A'
		};
		expect(citeArticle(bw7a).short).toBe('art. 7A:1576 BW');
		expect(citeArticle(bw7a).full).toBe('artikel 7A:1576 van het Burgerlijk Wetboek');
	});

	it('reads the law of an article from its BWB id', () => {
		const citation = articleCitation(
			{ bwb_id: 'BWBR0006000', article_number: '1576' },
			{ own: 'Burgerlijk Wetboek Boek 7A' }
		);
		expect(citation && citeArticle(citation).short).toBe('art. 7A:1576 BW');
	});

	it('keeps a lid it cannot name in words', () => {
		expect(ordinalWord('2a')).toBeNull();
		expect(citeArticle({ ...base, lid: '2a' }).full).toBe(
			'artikel 300, lid 2a, van het Wetboek van Strafrecht'
		);
		expect(partOfAnchor('lid-2-onder-a')).toEqual({ lid: '2', onderdelen: ['a'], aanhef: false });
		expect(partOfAnchor('lid-1-onder-d-onder-i')).toEqual({
			lid: '1',
			onderdelen: ['d', 'i'],
			aanhef: false
		});
		expect(partOfAnchor('lid-3-aanhef')).toEqual({ lid: '3', onderdelen: [], aanhef: true });
		// The anchor's `_2` (a second onderdeel q) is not printed.
		expect(partOfAnchor('onder-q_2-onder-1')).toEqual({
			lid: null,
			onderdelen: ['q', '1'],
			aanhef: false
		});
		expect(partOfAnchor('aanhef')).toEqual({ lid: null, onderdelen: [], aanhef: true });
		// A dash has no number to cite it by: from there the article is cited (Cbw 1).
		for (const dash of ['onder-_39', 'onder-_39-onder-a', 'lid-2-onder-_1'])
			expect(partOfAnchor(dash)).toEqual({ lid: null, onderdelen: [], aanhef: false });
	});

	it('cites an article without a number by its heading', () => {
		const forms = citeArticle({
			articleNumber: 'stam_16464063',
			heading: 'Algemene bepaling',
			shortTitle: 'Gw',
			citationTitle: 'Grondwet',
			date: new Date(2026, 8, 24)
		});
		expect(forms.short).toBe('Algemene bepaling Gw');
		expect(forms.full).toBe('Algemene bepaling van de Grondwet');
		expect(forms.dated).toBe('Algemene bepaling Gw (tekst geldend op 24 september 2026)');
	});
});

describe('citing an article of an act of the EU, its text as adopted (A53 #2)', () => {
	const avg = {
		articleNumber: '6',
		shortTitle: null,
		citationTitle: 'Verordening (EU) 2016/679',
		date: new Date(2026, 9, 20)
	};

	it('dates it on the day it was adopted, never as the text in force today', () => {
		const forms = citeArticle({ ...avg, adopted: { on: '2016-04-27' } });
		expect(forms.dated).toBe(
			'art. 6 Verordening (EU) 2016/679 (tekst zoals vastgesteld op 27 april 2016)'
		);
		expect(forms.dated).not.toMatch(/geldend/);
	});

	it('gives no dated form where the day it was adopted is not known', () => {
		expect(citeArticle({ ...avg, adopted: { on: null } }).dated).toBeNull();
	});

	it('carries the act’s day from the reader into every place of the article', () => {
		const c = articleCitation(
			{ article_number: '6' },
			{ own: 'Verordening (EU) 2016/679', adopted: { on: '2016-04-27' } }
		)!;
		expect(citeArticle({ ...c, lid: '1' }).dated).toBe(
			'art. 6 lid 1 Verordening (EU) 2016/679 (tekst zoals vastgesteld op 27 april 2016)'
		);
	});
});

describe('articleCitation', () => {
	const meta = { citationTitle: 'Algemene wet bestuursrecht', title: null, shortTitle: 'Awb' };
	it('cites by the name the article gives its law, the short title from the law', () => {
		expect(
			articleCitation({ article_number: '3:4' }, { own: 'Awb-titel', meta, displayName: 'x' })
		).toEqual({
			bwbId: null,
			articleNumber: '3:4',
			heading: null,
			shortTitle: 'Awb',
			citationTitle: 'Awb-titel'
		});
	});
	it('falls back to the law’s names, then the detail’s; an article without a number by its heading', () => {
		expect(articleCitation({ article_number: '3:4' }, { meta })?.citationTitle).toBe(
			'Algemene wet bestuursrecht'
		);
		expect(
			articleCitation(
				{ article_number: null, address: 'stam_1', label: 'Algemene bepaling' },
				{ displayName: 'Grondwet' }
			)
		).toEqual({
			bwbId: null,
			articleNumber: 'stam_1',
			heading: 'Algemene bepaling',
			shortTitle: null,
			citationTitle: 'Grondwet'
		});
		expect(articleCitation({ article_number: '1' }, {})).toBeNull();
	});
	it('cites the sole article of a law by its label, never by the number the BWB gives it', () => {
		// BWBR0007846: `enig-artikel`, labelled "Enig artikel".
		const c = articleCitation(
			{ article_number: 'enig-artikel', label: 'Enig artikel' },
			{ displayName: 'Aanpassing bedragen reis- en verblijfkosten leden Eerste Kamer' }
		);
		expect(c?.heading).toBe('Enig artikel');
		const forms = citeArticle({ ...c!, date: new Date(2026, 9, 21) });
		expect(forms.short).toBe(
			'Enig artikel Aanpassing bedragen reis- en verblijfkosten leden Eerste Kamer'
		);
		expect(forms.full).not.toContain('enig-artikel');
		// Without a label at hand, the name its number spells.
		expect(
			citeArticle({ articleNumber: 'enig-artikel', shortTitle: 'X', citationTitle: 'Wet X' }).short
		).toBe('Enig artikel X');
	});
});

describe('placeCitation', () => {
	const cbw = {
		articleNumber: '1',
		shortTitle: 'Cbw',
		citationTitle: 'Cyberbeveiligingswet'
	};
	// Cbw 1 as the API gives it: the unmarked definitions carry their term.
	const cbwParts = [
		{ id: 'aanhef', term: null },
		{ id: 'onder-_38', term: 'NIS2-richtlijn' },
		{ id: 'onder-_39', term: 'netwerk- en informatiesysteem' },
		{ id: 'onder-_39-onder-a', term: null },
		{ id: 'onder-_39-onder-b', term: null }
	];
	const cite = (anchor: string, parts: { id: string; term?: string | null }[]) =>
		citeArticle({ ...cbw, ...placeCitation(anchor, parts) });

	it('cites an onderdeel of an unmarked definition by the term it stands in', () => {
		expect(placeCitation('onder-_39-onder-a', cbwParts)).toEqual({
			lid: null,
			onderdelen: ['a'],
			aanhef: false,
			definitie: 'netwerk- en informatiesysteem'
		});
		const forms = cite('onder-_39-onder-a', cbwParts);
		expect(forms.short).toBe("art. 1, definitie van 'netwerk- en informatiesysteem', onder a Cbw");
		expect(forms.full).toBe(
			"artikel 1, definitie van 'netwerk- en informatiesysteem', onderdeel a, van de Cyberbeveiligingswet"
		);
	});

	it('cites the definition itself by its term', () => {
		const forms = cite('onder-_38', cbwParts);
		expect(forms.short).toBe("art. 1, definitie van 'NIS2-richtlijn' Cbw");
		expect(forms.full).toBe(
			"artikel 1, definitie van 'NIS2-richtlijn', van de Cyberbeveiligingswet"
		);
	});

	it('cites the list a definition paragraph leads (Wft 1:1), without its tekst', () => {
		const wft = {
			articleNumber: '1:1',
			shortTitle: 'Wft',
			citationTitle: 'Wet op het financieel toezicht'
		};
		const parts = [
			{ id: 'aanhef', term: null },
			{ id: 'tekst-6', term: 'adviseren' },
			{ id: 'tekst-6-onder-a', term: null },
			{ id: 'tekst-7', term: null }
		];
		const at = (anchor: string) => citeArticle({ ...wft, ...placeCitation(anchor, parts) });
		expect(at('tekst-6-onder-a').short).toBe("art. 1:1, definitie van 'adviseren', onder a Wft");
		expect(at('tekst-6-onder-a').full).toBe(
			"artikel 1:1, definitie van 'adviseren', onderdeel a, van de Wet op het financieel toezicht"
		);
		expect(at('tekst-6').short).toBe("art. 1:1, definitie van 'adviseren' Wft");
		// A paragraph without a term is the article's.
		expect(at('tekst-7').short).toBe('art. 1:1 Wft');
	});

	it('puts the definition after the lid', () => {
		const parts = [
			{ id: 'lid-2', term: null },
			{ id: 'lid-2-onder-_1', term: 'netwerk' },
			{ id: 'lid-2-onder-_1-onder-b', term: null }
		];
		const forms = cite('lid-2-onder-_1-onder-b', parts);
		expect(forms.short).toBe("art. 1 lid 2, definitie van 'netwerk', onder b Cbw");
		expect(forms.full).toBe(
			"artikel 1, tweede lid, definitie van 'netwerk', onderdeel b, van de Cyberbeveiligingswet"
		);
	});

	it('cites as before where the API gives no term', () => {
		const oud = cbwParts.map(({ id }) => ({ id }));
		// A dash has no number to cite it by: from there the article is cited.
		expect(placeCitation('onder-_39-onder-a', oud)).toEqual({
			lid: null,
			onderdelen: [],
			aanhef: false,
			definitie: null
		});
		expect(cite('onder-_39-onder-a', oud).short).toBe('art. 1 Cbw');
		expect(cite('lid-2-onder-a', oud).short).toBe('art. 1 lid 2 onder a Cbw');
		expect(placeCitation(null, cbwParts).definitie).toBeNull();
	});
});

describe('citePublication', () => {
	it('cites a publication by series, year and number, from its code or its abbreviation', () => {
		expect(citePublication('stb', 2026, '204')).toBe('Stb. 2026, 204');
		expect(citePublication('Stcrt', 2026, '35238')).toBe('Stcrt. 2026, 35238');
		expect(citePublication('Trb', 2018, '201')).toBe('Trb. 2018, 201');
	});

	it('cites nothing without all three', () => {
		expect(citePublication(null, 2026, '204')).toBeNull();
		expect(citePublication('stb', null, '204')).toBeNull();
		expect(citePublication('stb', 2026, null)).toBeNull();
	});
});

// What a place's menu in the text offers: the citation of the place a click lands on.
const bw = (articleNumber: string, book: string) => ({
	bwbId: BW_BOOKS[book.toLowerCase()],
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
		expect(forms.short).toBe('art. 1:2 BW');
		expect(forms.full).toBe('artikel 1:2 van het Burgerlijk Wetboek');
	});

	it('cites every paragraph of an article without leden as the article', () => {
		const parts = parseArticleParts('Eerste alinea.\nTweede alinea.');
		expect(parts.map((p) => cite(bw('9', '1'), parts, p).short)).toEqual([
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
		expect(forms.short).toBe('art. 6:162 lid 2 BW');
		expect(forms.full).toBe('artikel 6:162, tweede lid, van het Burgerlijk Wetboek');
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
				).short
			).toBe('art. 6:96 lid 2 BW');
			const a = cite(
				c,
				parts,
				find(parts, (p) => p.id === 'lid-2-onder-a')
			);
			expect(a.short).toBe('art. 6:96 lid 2 onder a BW');
			expect(a.full).toBe('artikel 6:96, tweede lid, onderdeel a, van het Burgerlijk Wetboek');
		}
		const aanhef = cite(
			c,
			api,
			find(api, (p) => p.id === 'lid-2-aanhef')
		);
		expect(aanhef.short).toBe('art. 6:96 lid 2 aanhef BW');
		expect(aanhef.full).toBe('artikel 6:96, tweede lid, aanhef, van het Burgerlijk Wetboek');
		// The closing words of a lid have no anchor of their own: they are the lid's.
		const slot = find(parsed, (p) => p.id === null);
		expect(cite(c, parsed, slot).short).toBe('art. 6:96 lid 2 BW');
	});

	it('cites an article with an aanhef and onderdelen but no leden', () => {
		const text =
			'Het verzuim treedt zonder ingebrekestelling in:\na. wanneer een termijn verstrijkt;\nb. wanneer de verbintenis voortvloeit uit onrechtmatige daad;\nc. wanneer de schuldeiser moet afleiden dat de schuldenaar zal tekortschieten.';
		const parts = parseArticleParts(text);
		const c = bw('83', '6');
		expect(parts.map((p) => cite(c, parts, p).short)).toEqual([
			'art. 6:83 aanhef BW',
			'art. 6:83 onder a BW',
			'art. 6:83 onder b BW',
			'art. 6:83 onder c BW'
		]);
		expect(cite(c, parts, parts[0]).full).toBe('artikel 6:83, aanhef, van het Burgerlijk Wetboek');
		expect(cite(c, parts, parts[2]).full).toBe(
			'artikel 6:83, onderdeel b, van het Burgerlijk Wetboek'
		);
	});
});
