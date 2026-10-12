import { describe, expect, it } from 'vitest';
import { articleCitation, citeArticle, ordinalWord, partOfAnchor, placeCitation } from './cite';

describe('citeArticle', () => {
	const base = { articleNumber: '300', shortTitle: 'Sr', citationTitle: 'Wetboek van Strafrecht' };

	it('cites a lid in the short, the long and the dated form', () => {
		const forms = citeArticle({ ...base, lid: '2', date: new Date(2026, 8, 22) });
		expect(forms.kort).toBe('art. 300 lid 2 Sr');
		expect(forms.voluit).toBe('artikel 300, tweede lid, van het Wetboek van Strafrecht');
		expect(forms.metDatum).toBe('art. 300 lid 2 Sr (tekst geldend op 22 september 2026)');
	});

	it('cites an onderdeel inside a lid, and an article without a short title', () => {
		expect(citeArticle({ ...base, lid: '2', onderdelen: ['a'] }).kort).toBe(
			'art. 300 lid 2 onder a Sr'
		);
		expect(citeArticle({ ...base, lid: '2', onderdelen: ['a'] }).voluit).toBe(
			'artikel 300, tweede lid, onderdeel a, van het Wetboek van Strafrecht'
		);
		expect(citeArticle({ ...base, shortTitle: null }).kort).toBe('art. 300 Wetboek van Strafrecht');
		expect(citeArticle(base).voluit).toBe('artikel 300 van het Wetboek van Strafrecht');
	});

	it('cites an onderdeel of an onderdeel, and the aanhef of a lid', () => {
		const forms = citeArticle({ ...base, articleNumber: '5', lid: '1', onderdelen: ['d', 'i'] });
		expect(forms.kort).toBe('art. 5 lid 1 onder d sub i Sr');
		expect(forms.voluit).toBe(
			'artikel 5, eerste lid, onderdeel d, onder i, van het Wetboek van Strafrecht'
		);
		expect(citeArticle({ ...base, lid: '3', aanhef: true }).kort).toBe('art. 300 lid 3 aanhef Sr');
	});

	it('puts the book of the Burgerlijk Wetboek before the article', () => {
		const bw7 = {
			articleNumber: '3',
			shortTitle: 'BW',
			citationTitle: 'Burgerlijk Wetboek Boek 7'
		};
		expect(citeArticle({ ...bw7, lid: '3', onderdelen: ['a'] }).kort).toBe(
			'art. 7:3 lid 3 onder a BW'
		);
		expect(citeArticle(bw7).voluit).toBe('artikel 7:3 van het Burgerlijk Wetboek');
		// The API names the book itself `BW6`; the citation names the code.
		expect(
			citeArticle({
				articleNumber: '162',
				shortTitle: 'BW6',
				citationTitle: 'Burgerlijk Wetboek Boek 6'
			}).kort
		).toBe('art. 6:162 BW');
	});

	it('keeps a lid it cannot name in words', () => {
		expect(ordinalWord('2a')).toBeNull();
		expect(citeArticle({ ...base, lid: '2a' }).voluit).toBe(
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
		expect(forms.kort).toBe('Algemene bepaling Gw');
		expect(forms.voluit).toBe('Algemene bepaling van de Grondwet');
		expect(forms.metDatum).toBe('Algemene bepaling Gw (tekst geldend op 24 september 2026)');
	});
});

describe('articleCitation', () => {
	const meta = { citationTitle: 'Algemene wet bestuursrecht', title: null, shortTitle: 'Awb' };
	it('cites by the name the article gives its law, the short title from the law', () => {
		expect(
			articleCitation({ article_number: '3:4' }, { own: 'Awb-titel', meta, displayName: 'x' })
		).toEqual({
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
			articleNumber: 'stam_1',
			heading: 'Algemene bepaling',
			shortTitle: null,
			citationTitle: 'Grondwet'
		});
		expect(articleCitation({ article_number: '1' }, {})).toBeNull();
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
		expect(forms.kort).toBe("art. 1, definitie van 'netwerk- en informatiesysteem', onder a Cbw");
		expect(forms.voluit).toBe(
			"artikel 1, definitie van 'netwerk- en informatiesysteem', onderdeel a, van de Cyberbeveiligingswet"
		);
	});

	it('cites the definition itself by its term', () => {
		const forms = cite('onder-_38', cbwParts);
		expect(forms.kort).toBe("art. 1, definitie van 'NIS2-richtlijn' Cbw");
		expect(forms.voluit).toBe(
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
		expect(at('tekst-6-onder-a').kort).toBe("art. 1:1, definitie van 'adviseren', onder a Wft");
		expect(at('tekst-6-onder-a').voluit).toBe(
			"artikel 1:1, definitie van 'adviseren', onderdeel a, van de Wet op het financieel toezicht"
		);
		expect(at('tekst-6').kort).toBe("art. 1:1, definitie van 'adviseren' Wft");
		// A paragraph without a term is the article's.
		expect(at('tekst-7').kort).toBe('art. 1:1 Wft');
	});

	it('puts the definition after the lid', () => {
		const parts = [
			{ id: 'lid-2', term: null },
			{ id: 'lid-2-onder-_1', term: 'netwerk' },
			{ id: 'lid-2-onder-_1-onder-b', term: null }
		];
		const forms = cite('lid-2-onder-_1-onder-b', parts);
		expect(forms.kort).toBe("art. 1 lid 2, definitie van 'netwerk', onder b Cbw");
		expect(forms.voluit).toBe(
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
		expect(cite('onder-_39-onder-a', oud).kort).toBe('art. 1 Cbw');
		expect(cite('lid-2-onder-a', oud).kort).toBe('art. 1 lid 2 onder a Cbw');
		expect(placeCitation(null, cbwParts).definitie).toBeNull();
	});
});
