import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, slow, type FakeRequest } from '$lib/test/fakeApi';
import type { BronRef } from '$lib/bron/href';
import type { SearchKind } from './lanes';
import { isSlow } from '$lib/api/errors';
import { SearchSession } from './session.svelte';

type Query = { q: string; types: SearchKind[]; resolve?: boolean; mode: string };
type Asked = { query: Query; signal?: AbortSignal; answer: (value: unknown) => void };

const hit = (collection: SearchKind, key: string, score = 1) => ({
	id: `${collection}/${key}`,
	key,
	collection,
	display_name: key,
	score
});

/** The API of a search: every /api/search waits until the test answers it. */
function api(routes: Parameters<typeof fakeApi>[0] = {}) {
	const asked: Asked[] = [];
	const fake = fakeApi({
		'/api/search': (r: FakeRequest) =>
			new Promise((answer) =>
				asked.push({ query: r.params.query as unknown as Query, signal: r.signal, answer })
			),
		...routes
	});
	/** The open request of the lane that asks for `kind`. */
	const of = (kind: SearchKind) => {
		const found = asked.filter((a) => a.query.types.includes(kind) && !a.signal?.aborted);
		return found.at(-1)!;
	};
	return { asked, of, fake };
}

/** A search with its effects, that records what it opened. */
function session(kinds?: SearchKind[], toResults = false) {
	const opened: (BronRef | string)[] = [];
	const results: string[] = [];
	const s = new SearchSession(
		(ref) => opened.push(ref),
		toResults ? (q) => results.push(q) : undefined
	);
	if (kinds) s.kinds = kinds;
	const stop = $effect.root(() => s.connect());
	flushSync();
	return { s, opened, results, stop };
}

/** Typing, then the pause every request waits for. */
async function type(s: SearchSession, text: string) {
	s.query = text;
	flushSync();
	await vi.advanceTimersByTimeAsync(150);
	flushSync();
}

/** An answer in, and what follows from it. */
async function settle() {
	await vi.advanceTimersByTimeAsync(0);
	flushSync();
}

const answer = (results: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
	q: '',
	types: [],
	results,
	...extra
});

// SvelteKit's client runtime wants a page; the search reads only its address.
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the lanes of a search', () => {
	it('asks the fast kinds from two characters, every lane from three, each on its own', async () => {
		const { asked } = api();
		const { s, stop } = session();
		await type(s, 'h');
		expect(asked).toHaveLength(0);
		await type(s, 'hu');
		expect(asked.map((a) => a.query.types)).toEqual([
			[
				'instruments',
				'dossiers',
				'cabinets',
				'members',
				'commitments',
				'factions',
				'committees',
				'decisions'
			]
		]);
		await type(s, 'huu');
		expect(asked.slice(1).map((a) => [a.query.types, a.query.resolve])).toEqual([
			[
				[
					'instruments',
					'dossiers',
					'cabinets',
					'members',
					'commitments',
					'factions',
					'committees',
					'decisions'
				],
				true
			],
			[['articles', 'documents'], undefined],
			[['judgments'], undefined]
		]);
		expect(asked.every((a) => a.query.mode === 'live')).toBe(true);
		stop();
	});

	it('aborts the fast request on typing on, and lets a slow lane ask once its request is done', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		const judgments = of('judgments');
		const fast = of('instruments');
		await type(s, 'huurw');
		await type(s, 'huurwo');
		expect(fast.signal?.aborted).toBe(true);
		// One request per lane at a time: the judgments wait, then only the latest goes.
		expect(asked.filter((a) => a.query.types.includes('judgments'))).toHaveLength(1);
		judgments.answer(answer({ judgments: [hit('judgments', 'oud')] }));
		await settle();
		const next = asked.filter((a) => a.query.types.includes('judgments'));
		expect(next.map((a) => a.query.q)).toEqual(['huur', 'huurwo']);
		// The answer to an older query is not shown.
		expect(s.hitsOf('judgments')).toEqual([]);
		stop();
	});

	it('names the Beste treffer only once every lane is in, in the one order of the groups', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		of('articles').answer(answer({ articles: [hit('articles', 'art', 1)] }));
		await settle();
		expect(s.best).toBe(null);
		expect(s.bestComing).toBe(true);
		// The judgments' group holds its place while they come.
		expect(s.shown.map((g) => [g.kind, g.pending])).toEqual([
			['instruments', false],
			['articles', false],
			['judgments', true]
		]);
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		expect(s.allIn).toBe(true);
		expect(s.best?.hit.id).toBe('instruments/huurwet');
		stop();
	});

	it('says a lane that failed in its group, and asks only that lane again', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(answer({ instruments: [hit('instruments', 'w')] }));
		of('articles').answer(answer({ articles: [] }));
		of('judgments').answer(fail(500));
		await settle();
		expect(s.failedLanes.map((l) => [l.id, s.lanes[l.id].status])).toEqual([
			['judgments', 'failed']
		]);
		expect(s.failure).toBe(null);
		expect(s.groups.map((g) => g.kind)).toEqual(['instruments']);
		const before = asked.length;
		s.retry('judgments');
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.slice(before).map((a) => a.query.types)).toEqual([['judgments']]);
		stop();
	});

	it('says one failure once, with one Opnieuw that asks every failed lane again', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(fail(500));
		of('articles').answer(fail(500));
		of('judgments').answer(fail(500));
		await settle();
		expect(s.failure).not.toBe(null);
		expect(s.failedLanes).toEqual([]);
		const before = asked.length;
		s.retrySearch();
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.slice(before).flatMap((a) => a.query.types)).toEqual(
			expect.arrayContaining(['instruments', 'articles', 'judgments'])
		);
		stop();
	});

	it('says that the search took too long when the fast lane does, and asks it again', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'hu');
		of('instruments').answer(slow());
		await settle();
		expect(isSlow(s.failure?.error)).toBe(true);
		expect(s.answered).toBe('hu');
		s.retrySearch();
		flushSync();
		expect(s.failure).toBe(null);
		await vi.advanceTimersByTimeAsync(150);
		expect(asked).toHaveLength(2);
		stop();
	});

	it('offers "Meer uitspraken" where the live mode left judgments out, and asks every lane in full', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(answer({ instruments: [] }));
		of('articles').answer(answer({ articles: [] }));
		of('judgments').answer(
			answer({ judgments: [hit('judgments', 'a')] }, { partial: { judgments: true } })
		);
		await settle();
		expect([...s.moreKinds]).toEqual(['judgments']);
		expect(s.empty).toBe(false);
		const before = asked.length;
		s.askInFull();
		flushSync();
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.slice(before).map((a) => a.query.mode)).toEqual(['full', 'full', 'full']);
		expect(s.moreKinds.size).toBe(0);
		stop();
	});

	it('asks in full by itself where the live mode left kinds out and found nothing in them', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('judgments').answer(answer({ judgments: [] }, { partial: { judgments: true } }));
		await settle();
		expect(s.fullFor).toBe('huur');
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.at(-1)?.query.mode).toBe('full');
		stop();
	});

	it('names the Beste treffer once, after the answers in full, where it asks in full by itself (#118)', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		const named: (string | undefined)[] = [];
		const watch = $effect.root(() => {
			$effect(() => {
				if (s.best) named.push(s.best.hit.id);
			});
		});
		await type(s, 'huur');
		of('articles').answer(answer({ articles: [hit('articles', 'live', 1)] }));
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		of('instruments').answer(
			answer({ instruments: [] }, { resolved: null, partial: { instruments: true } })
		);
		await settle();
		expect(s.fullFor).toBe('huur');
		// Asked again, in full: the lanes are not in until that answer is, also while it waits.
		expect(s.allIn).toBe(false);
		expect(s.best).toBe(null);
		s.pressEnter();
		await settle();
		expect(opened).toEqual([]);
		await vi.advanceTimersByTimeAsync(150);
		flushSync();
		expect(s.allIn).toBe(false);
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		of('articles').answer(answer({ articles: [hit('articles', 'live', 1)] }));
		await settle();
		expect(s.best).toBe(null);
		expect(opened).toEqual([]);
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		expect(named).toEqual(['instruments/huurwet']);
		expect(opened).toEqual(['instruments/huurwet']);
		watch();
		stop();
	});

	it('opens no hit for an Enter while a lane is still on its way', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet')] }, { resolved: null })
		);
		of('articles').answer(answer({ articles: [] }));
		await settle();
		s.pressEnter();
		await settle();
		expect(opened).toEqual([]);
		of('judgments').answer(answer({ judgments: [hit('judgments', 'arrest', 3)] }));
		await settle();
		expect(s.best?.hit.id).toBe('instruments/huurwet');
		expect(opened).toEqual(['instruments/huurwet']);
		stop();
	});

	it('lets the first lane in scope say what the query cites, where the fast kinds are not searched', async () => {
		const { asked, of } = api();
		const { s, stop } = session(['judgments']);
		await type(s, 'huur');
		expect(asked.map((a) => [a.query.types, a.query.resolve])).toEqual([[['judgments'], true]]);
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		expect(s.answered).toBe('huur');
		expect(s.empty).toBe(true);
		stop();
	});
});

describe('Enter and the citations', () => {
	it('opens the first row once every answer is in, for an Enter before the answer (#79)', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huur');
		s.pressEnter();
		expect(opened).toEqual([]);
		of('instruments').answer(answer({ instruments: [hit('instruments', 'huurwet')] }));
		of('articles').answer(answer({ articles: [] }));
		await settle();
		expect(opened).toEqual([]);
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		expect(opened).toEqual(['instruments/huurwet']);
		stop();
	});

	it('drops an Enter before the answer when an arrow key chooses', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'hu');
		s.pressEnter();
		s.down();
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'a'), hit('instruments', 'b')] })
		);
		await settle();
		expect(opened).toEqual([]);
		stop();
	});

	/** The answer of the resolving lane for a notation the API reads, with its match. */
	const notation = (
		kind: string,
		parts: Record<string, unknown>,
		match: Record<string, unknown>
	) => ({
		resolved: {
			kind: match.kind,
			match: { id: `${match.collection}/${match.key}`, path: null, ...match },
			alternatives: [],
			qualifier: null,
			notation: {
				kind,
				parts: {
					identifier: null,
					dossier_number: null,
					suffix: null,
					sequence: null,
					articles: [],
					qualifier: null,
					choice: false,
					...parts
				}
			}
		}
	});

	it('shows the citation row for a notation the API reads, and opens its match (F108)', async () => {
		for (const [q, kind, parts, match] of [
			[
				'TZ202603-130',
				'commitment',
				{ identifier: 'TZ202603-130' },
				{ kind: 'commitment', collection: 'commitments', key: '74065c45' }
			],
			[
				'Sr 287',
				'article',
				{ articles: [{ law_id: 'BWBR0001854', number: '287' }] },
				{ kind: 'article', collection: 'articles', key: 'bwbr0001854_287' }
			]
		] as const) {
			const { of, fake } = api();
			const { s, opened, stop } = session();
			await type(s, q);
			of('instruments').answer(answer({}, notation(kind, parts, match)));
			await settle();
			expect(s.citation?.kind).toBe(kind);
			s.pressEnter();
			await settle();
			expect(opened).toEqual([{ collection: match.collection, key: match.key }]);
			expect(fake.asked('/api/resolve')).toEqual([]);
			stop();
		}
	});

	it('opens "55 Gw" as the article the API reads, also for an Enter before the answer', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, '55 Gw');
		expect(s.citation).toBe(null);
		s.pressEnter();
		of('instruments').answer(
			answer(
				{},
				notation(
					'article',
					{ articles: [{ law_id: 'BWBR0001840', number: '55' }] },
					{ kind: 'article', collection: 'articles', key: 'bwbr0001840_55' }
				)
			)
		);
		await settle();
		expect(opened).toEqual([{ collection: 'articles', key: 'bwbr0001840_55' }]);
		stop();
	});

	it('opens an ECLI by what the search resolved, without asking again', async () => {
		const { of, fake } = api();
		const { s, opened, stop } = session();
		const ecli = 'ECLI:NL:HR:2019:2006';
		await type(s, ecli);
		of('instruments').answer(
			answer(
				{},
				notation(
					'ecli',
					{ identifier: ecli },
					{ kind: 'judgment', collection: 'judgments', key: 'ecli_nl_hr_2019_2006' }
				)
			)
		);
		await settle();
		expect(s.citation?.kind).toBe('ecli');
		s.pressEnter();
		await settle();
		expect(opened).toEqual([{ collection: 'judgments', key: 'ecli_nl_hr_2019_2006' }]);
		expect(fake.asked('/api/resolve')).toEqual([]);
		stop();
	});

	it('opens a dossier by the number of its address: "21501-31" and "36327-999" (#64)', async () => {
		for (const [q, sequence, key, number] of [
			['21501-31', '31', '21501_31', '21501-31'],
			['36327-999', '999', '36327', '36327']
		]) {
			const { of } = api();
			const { s, opened, stop } = session();
			await type(s, q);
			of('instruments').answer(
				answer(
					{},
					notation(
						'document',
						{ dossier_number: q.split('-')[0], sequence },
						{ kind: 'dossier', collection: 'dossiers', key, path: `/dossiers/${number}` }
					)
				)
			);
			await settle();
			s.pressEnter();
			await settle();
			expect(opened).toEqual([{ collection: 'dossiers', key, number }]);
			stop();
		}
	});

	it('says a citation the data does not have where its row was', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, '99999');
		const none = notation('dossier', { dossier_number: '99999' }, {});
		of('instruments').answer(
			answer({}, { resolved: { ...none.resolved, kind: 'none', match: null } })
		);
		await settle();
		expect(s.citation?.kind).toBe('dossier');
		s.pressEnter();
		await settle();
		expect(opened).toEqual([]);
		expect(s.notFound).toBe(true);
		expect(s.citation).toBe(null);
		stop();
	});

	it('opens the law an abbreviation stands for before any hit', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'AVG');
		s.pressEnter();
		of('instruments').answer(
			answer(
				{ instruments: [hit('instruments', 'uavg')] },
				{
					resolved: {
						match: { kind: 'instrument', collection: 'instruments', key: 'bwbr0040940' },
						notation: null
					}
				}
			)
		);
		await settle();
		expect(opened).toEqual([{ collection: 'instruments', key: 'bwbr0040940' }]);
		stop();
	});

	it('says a law named by a title the API does not know is outside Concordans', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'Omgevingswet');
		of('instruments').answer(answer({ instruments: [] }, { resolved: null }));
		await settle();
		expect(s.outsideLaw).toBe(true);
		stop();
	});
});

describe('Enter and the best the API names (besluit 30)', () => {
	/** Every lane answers: the fast kinds `fast`, the others nothing, each with `more`. */
	async function answerAll(
		of: (kind: SearchKind) => Asked,
		fast: Record<string, unknown>,
		more: Record<string, unknown>,
		text: Record<string, unknown> = {}
	) {
		of('instruments').answer(answer(fast, more));
		of('articles').answer(answer(text, more));
		of('judgments').answer(answer({ judgments: [] }, more));
		await settle();
	}

	it('opens the best the API names: a citation of an article is exact', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'artikel 6:162 BW');
		const article = { ...hit('articles', 'bwbr0005289_boek6_art162'), exact: true };
		await answerAll(
			of,
			{ instruments: [hit('instruments', 'bw')] },
			{ best: article.id },
			{ articles: [article] }
		);
		expect(s.best?.hit.id).toBe(article.id);
		s.pressEnter();
		expect(opened).toEqual([article.id]);
		stop();
	});

	it('goes to the page of results for words that name nothing, where the field has one (besluit 31)', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'huurverhoging');
		await answerAll(
			of,
			{ instruments: [hit('instruments', 'huurwet')] },
			{ best: null, matched: 'all' },
			{ articles: [hit('articles', 'reparatiewet_ix')] }
		);
		s.pressEnter();
		expect(results).toEqual(['huurverhoging']);
		expect(opened).toEqual([]);
		stop();
	});

	it('still opens the best the API names, with a page of results at hand', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'artikel 6:162 BW');
		const article = { ...hit('articles', 'bwbr0005289_boek6_art162'), exact: true };
		await answerAll(of, { instruments: [] }, { best: article.id }, { articles: [article] });
		s.pressEnter();
		expect(opened).toEqual([article.id]);
		expect(results).toEqual([]);
		stop();
	});

	it('opens nothing for words that name nothing: Enter chooses the first row, a second opens it', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huurverhoging');
		await answerAll(
			of,
			{ instruments: [hit('instruments', 'huurwet')] },
			{ best: null, matched: 'all' },
			{ articles: [hit('articles', 'reparatiewet_ix')] }
		);
		expect(s.best).toBeNull();
		expect(s.isActive(0)).toBe(false);
		s.pressEnter();
		expect(opened).toEqual([]);
		expect(s.isActive(0)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual(['instruments/huurwet']);
		stop();
	});

	it('takes the one exact hit over the lanes where no lane names a best', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'kelderluik');
		await answerAll(
			of,
			{ instruments: [] },
			{ best: null },
			{ articles: [{ ...hit('articles', 'a'), exact: true }, hit('articles', 'b')] }
		);
		expect(s.bestId).toBe('articles/a');
		s.pressEnter();
		expect(opened).toEqual(['articles/a']);
		stop();
	});

	it('keeps the older Enter where the API names no best at all', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huur');
		await answerAll(of, { instruments: [hit('instruments', 'huurwet')] }, {});
		s.pressEnter();
		expect(opened).toEqual(['instruments/huurwet']);
		stop();
	});

	it('asks in full for an Enter on an empty live list, and says the words it matched in part', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'toezeggingen pensioenen');
		await answerAll(of, { commitments: [] }, { best: null });
		s.pressEnter();
		await vi.advanceTimersByTimeAsync(150);
		expect(s.fullFor).toBe('toezeggingen pensioenen');
		const full = asked.filter((a) => a.query.mode === 'full');
		expect(full.length).toBeGreaterThan(0);
		await answerAll(
			of,
			{ commitments: [hit('commitments', 'tz1')] },
			{ best: null, matched: 'any', left_out: ['de'] }
		);
		expect(s.partialKinds.has('commitments')).toBe(true);
		expect(s.leftOut).toEqual(['de']);
		stop();
	});

	it('offers the longer words of a query that found nothing, one at a time', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'pensioenen verzamelwoord');
		await answerAll(of, {}, { best: null });
		expect(s.empty).toBe(true);
		expect(s.narrower).toEqual(['pensioenen', 'verzamelwoord']);
		stop();
	});
});
