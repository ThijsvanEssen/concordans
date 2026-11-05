import { describe, expect, it } from 'vitest';
import { CITE_MAX, citeText, type ArticleCite } from './cite-label';

const cite = (labels: string[], abbr: string): ArticleCite => ({
	full: `art. ${labels.join(', ')} ${abbr}`,
	count: labels.length,
	abbr,
	articles: labels.map((label, i) => ({ label, key: `k${i}`, at: null }))
});

describe('citeText', () => {
	it('keeps a short label whole', () => {
		expect(citeText(cite(['19', '23 lid 1'], 'Cbb'))).toBe('art. 19, 23 lid 1 Cbb');
	});

	it('keeps the first article whole, so two lids of one article never read alike (B116)', () => {
		const a = citeText(cite(['4.20 lid 4 onder a'], 'Comptabiliteitswet 2016'));
		const b = citeText(cite(['4.20 lid 4 onder b'], 'Comptabiliteitswet 2016'));
		expect(a).not.toBe(b);
		expect(a.startsWith('art. 4.20 lid 4 onder a ')).toBe(true);
		expect(a.length).toBeLessThanOrEqual(CITE_MAX);
	});

	it('names the first and how many more, the law cut behind them', () => {
		const t = citeText(
			cite(['3.1 lid 1', '3.2', '3.3', '3.4', '3.5'], 'Besluit elektronische publicaties')
		);
		expect(t).toBe('art. 3.1 lid 1 +4 Besluit…');
	});
});
