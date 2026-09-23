import { describe, expect, it } from 'vitest';
import { citeArticle, ordinalWord, partOfAnchor } from './cite';

describe('citeArticle', () => {
	const base = { articleNumber: '300', shortTitle: 'Sr', citationTitle: 'Wetboek van Strafrecht' };

	it('cites a lid in the short, the long and the dated form', () => {
		const forms = citeArticle({ ...base, lid: '2', date: new Date(2026, 8, 22) });
		expect(forms.kort).toBe('art. 300 lid 2 Sr');
		expect(forms.voluit).toBe('artikel 300, tweede lid, Wetboek van Strafrecht');
		expect(forms.metDatum).toBe('Art. 300 lid 2 Sr (geldend op 22 september 2026)');
	});

	it('cites an onderdeel inside a lid, and an article without a short title', () => {
		expect(citeArticle({ ...base, lid: '2', onderdeel: 'a' }).kort).toBe(
			'art. 300 lid 2, onder a, Sr'
		);
		expect(citeArticle({ ...base, lid: '2', onderdeel: 'a' }).voluit).toBe(
			'artikel 300, tweede lid, onder a, Wetboek van Strafrecht'
		);
		expect(citeArticle({ ...base, shortTitle: null }).kort).toBe('art. 300 Wetboek van Strafrecht');
		expect(citeArticle(base).voluit).toBe('artikel 300, Wetboek van Strafrecht');
	});

	it('keeps a lid it cannot name in words', () => {
		expect(ordinalWord('2a')).toBeNull();
		expect(citeArticle({ ...base, lid: '2a' }).voluit).toBe(
			'artikel 300, lid 2a, Wetboek van Strafrecht'
		);
		expect(partOfAnchor('lid-2-onder-a')).toEqual({ lid: '2', onderdeel: 'a' });
		expect(partOfAnchor('aanhef')).toEqual({ lid: null, onderdeel: null });
	});
});
