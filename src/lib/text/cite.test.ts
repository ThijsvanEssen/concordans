import { describe, expect, it } from 'vitest';
import { citeArticle, ordinalWord, partOfAnchor } from './cite';

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
		expect(partOfAnchor('aanhef')).toEqual({ lid: null, onderdelen: [], aanhef: true });
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
