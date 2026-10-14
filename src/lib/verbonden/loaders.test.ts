import { describe, expect, it } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { basesLine, implementationLine, LOADERS, type LoaderContext } from './loaders';
import type { Neighbor } from './rows';

describe('basesLine', () => {
	it('says what an implementation rests on', () => {
		expect(basesLine(['national_implementing_measure'])).toBe(
			'uitvoeringsmaatregel volgens EUR-Lex'
		);
		expect(basesLine(['national_implementing_measure', 'considerans'])).toBe(
			'uitvoeringsmaatregel volgens EUR-Lex, volgens de considerans'
		);
		expect(basesLine([])).toBeNull();
		expect(basesLine(undefined)).toBeNull();
	});
});

describe('implementationLine (BE-58)', () => {
	const via = [
		{ publication: 'stb-1992-315', citation: 'Stb. 1992, 315' },
		{ publication: 'stb-2013-102', citation: 'Stb. 2013, 102' }
	];
	const bases = ['national_implementing_measure'];

	it('says a change to implement only for a measure that amends the law (Awb, Richtlijn 2018/1972)', () => {
		expect(implementationLine({ bases, via }, new Set(['stb_2013_102']))).toBe(
			'gewijzigd ter implementatie door Stb. 2013, 102; uitvoeringsmaatregel Stb. 1992, 315 volgens EUR-Lex'
		);
	});

	it('names the measures as EUR-Lex has them when none amends the law', () => {
		expect(implementationLine({ bases, via: [via[0]] }, new Set())).toBe(
			'uitvoeringsmaatregel Stb. 1992, 315 volgens EUR-Lex'
		);
	});

	it('keeps the bases where EUR-Lex names no measure', () => {
		expect(implementationLine({ bases: ['considerans'], via: [] }, new Set())).toBe(
			'volgens de considerans'
		);
	});
});

describe('the articles a conclusion cites (#51)', () => {
	it('places them "onder 3", as the conclusion cites its points, never "r.o. 3"', async () => {
		fakeApi({ '/api/judgments/{ecli}': fail(404) });
		const article = {
			id: 'articles/bwbr0001903_432',
			key: 'bwbr0001903_432',
			collection: 'articles',
			display_name: 'Artikel 432 Wetboek van Strafvordering',
			props: { bwb_id: 'BWBR0001903', article_number: '432' },
			relation: 'REFERS_TO',
			direction: 'outbound',
			confidence: 0.95,
			meta: { reason: 'bwb_article', mention_count: 1, paragraphs: ['3'] }
		} as unknown as Neighbor;
		const { rows } = await LOADERS['judgment-articles']({
			node: {
				id: 'judgments/ecli_nl_phr_2026_901',
				key: 'ecli_nl_phr_2026_901',
				props: { ecli: 'ECLI:NL:PHR:2026:901' }
			} as unknown as LoaderContext['node'],
			neighbors: [article],
			totals: new Map(),
			buren: async () => [article],
			signal: new AbortController().signal
		});
		expect(rows[0].position).toBe('onder 3');
	});
});
