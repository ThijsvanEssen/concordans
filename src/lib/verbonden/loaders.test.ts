import { describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, type ApiPath, type FakeAnswer } from '$lib/test/fakeApi';
import {
	basesLine,
	DEFAULT_LOADER_OPTIONS,
	implementationLine,
	LOADERS,
	type LoaderContext
} from './loaders';
import type { Loader } from './groups';
import type { Neighbor } from '$lib/api/nodes';

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
		{ id: 'instruments/stb_1992_315', citation: 'Stb. 1992, 315' },
		{ id: 'instruments/stb_2013_102', citation: 'Stb. 2013, 102' }
	];
	const bases = ['national_implementing_measure'];

	it('says a change to implement only for a measure that amends the law (Awb, Richtlijn 2018/1972)', () => {
		expect(implementationLine({ bases, via }, new Set(['instruments/stb_2013_102']))).toBe(
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
			signal: new AbortController().signal,
			options: DEFAULT_LOADER_OPTIONS
		});
		expect(rows[0].position).toBe('onder 3');
	});
});

describe('a loader of a route of the API (code-eenvoud F97)', () => {
	const ARTICLE = { bwb_id: 'BWBR0005537', article_number: '8:72', key: 'bwbr0005537_8_72' };
	const LAW = { bwb_id: 'BWBR0005537', key: 'bwbr0005537' };
	const judgment = { key: 'ecli_nl_hr_2020_1', ecli: 'ECLI:NL:HR:2020:1', date: '2020-01-10' };
	const ROUTES: [Loader, Record<string, unknown>, Partial<Record<ApiPath, FakeAnswer>>][] = [
		[
			'article-explanatory',
			ARTICLE,
			{
				'/api/articles/{bwb_id}/{article_number}/explained-by': {
					total: 1,
					items: [
						{
							scope: 'article',
							document: { key: 'mvt', kind: 'Memorie van toelichting', title: 'Memorie' }
						}
					]
				}
			}
		],
		[
			'article-changes',
			ARTICLE,
			{
				'/api/articles/{bwb_id}/{article_number}/legislative-history': {
					total: 1,
					entries: [{ dossier_number: '32450', document_id: 'instruments/stb_2012_682' }]
				}
			}
		],
		[
			'article-judgments',
			ARTICLE,
			{
				'/api/articles/{bwb_id}/{article_number}/cited-by': {
					total: 1,
					judgment_total: 1,
					echr_judgment_total: 0,
					items: [{ judgment, paragraph_number: '3.1', text: 'artikel 8:72' }]
				}
			}
		],
		[
			'article-delegated',
			ARTICLE,
			{
				'/api/articles/{bwb_id}/{article_number}/delegated': {
					total: 1,
					items: [{ instrument: { key: 'bwbr0006358', bwb_id: 'BWBR0006358' }, kind: 'AMvB' }]
				}
			}
		],
		[
			'instrument-international',
			LAW,
			{
				'/api/instruments/{identifier}/eu-links': {
					international: [{ instrument: { key: 'trb_1951_154', title: 'EVRM' } }]
				}
			}
		],
		[
			'instrument-articles',
			LAW,
			{
				'/api/instruments/{bwb_id}/articles': {
					total: 1,
					items: [{ key: 'bwbr0005537_1_1', article_number: '1:1' }]
				}
			}
		],
		[
			'instrument-judgments',
			LAW,
			{ '/api/instruments/{bwb_id}/judgments': { total: 1, items: [judgment] } }
		],
		[
			'committee-activities',
			{ slug: 'justitie', key: 'c1' },
			{
				'/api/committees/{slug}/activities': {
					total: 1,
					items: [{ key: 'a1', kind: 'Commissiedebat', date: '2026-01-01' }]
				}
			}
		],
		[
			'dossier-committees',
			{ label: '36764', key: '36764' },
			{
				'/api/dossiers/{number}': {
					key: '36764',
					number: '36764',
					instruments: [],
					committees: [{ key: 'c1', name: 'Vaste commissie voor Digitale Zaken' }]
				},
				'/api/dossiers/{number}/documents': { total: 0, items: [] }
			}
		]
	];

	it.each(ROUTES)(
		'%s reads its route, not the buckets of the node',
		async (loader, props, routes) => {
			fakeApi(routes);
			const buren = vi.fn(async () => {
				throw new Error('the buckets of the node were asked');
			});
			const { rows } = await LOADERS[loader]({
				node: { id: 'x/y', key: String(props.key), props } as LoaderContext['node'],
				neighbors: [],
				totals: new Map(),
				buren,
				signal: new AbortController().signal,
				options: DEFAULT_LOADER_OPTIONS
			});
			expect(buren).not.toHaveBeenCalled();
			expect(rows).toHaveLength(1);
		}
	);
});
