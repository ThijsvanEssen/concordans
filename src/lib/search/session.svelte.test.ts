import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, slow, type FakeRequest } from '$lib/test/fakeApi';
import type { BronRef } from '$lib/bron/ref';
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
				'ministries',
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
					'ministries',
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
		// The fast lane asks live; the text and the judgments ask in full at once.
		expect(asked.map((a) => a.query.mode)).toEqual(['live', 'live', 'full', 'full']);
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

	it('holds the place of a group still coming, in the one order of the groups', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		of('articles').answer(answer({ articles: [hit('articles', 'art', 1)] }));
		await settle();
		// The judgments' group holds its place while they come.
		expect(s.shown.map((g) => [g.kind, g.pending])).toEqual([
			['instruments', false],
			['articles', false],
			['judgments', true]
		]);
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		expect(s.allIn).toBe(true);
		stop();
	});

	it('brings no group in above one shown: the slower lanes wait for the fast one (B117)', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('articles').answer(answer({ articles: [hit('articles', 'art', 1)] }));
		await settle();
		// The articles are in before the laws: nothing stands yet, no place is held.
		expect(s.shown).toEqual([]);
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		await settle();
		expect(s.shown.map((g) => [g.kind, g.pending])).toEqual([
			['instruments', false],
			['articles', false],
			['judgments', true]
		]);
		stop();
	});

	it('keeps the slower groups back while the fast lane asks again in full (B117)', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('articles').answer(answer({ articles: [hit('articles', 'art', 1)] }));
		of('instruments').answer(
			answer({ instruments: [] }, { resolved: null, partial: { instruments: true } })
		);
		await settle();
		expect(s.fullFor).toBe('huur');
		expect(s.shown).toEqual([]);
		await vi.advanceTimersByTimeAsync(150);
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		await settle();
		expect(s.shown.map((g) => g.kind)).toEqual(['instruments', 'articles', 'judgments']);
		stop();
	});

	it('shows the groups once the fast answer in full is in, though it still says partial (B117)', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'onrechtmatige daad');
		of('articles').answer(answer({ articles: [hit('articles', 'art', 1)] }));
		of('instruments').answer(
			answer({ instruments: [] }, { resolved: null, partial: { instruments: true, members: true } })
		);
		await settle();
		await vi.advanceTimersByTimeAsync(150);
		// The answer in full leaves members out too: no more to ask, so it is in.
		of('instruments').answer(
			answer(
				{ instruments: [hit('instruments', 'bw6', 2)] },
				{ resolved: null, partial: { members: true } }
			)
		);
		await settle();
		expect(s.shown.map((g) => g.kind)).toEqual(['instruments', 'articles', 'judgments']);
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

	it('offers "Meer dossiers" where the live mode left them out, and asks the fast lane in full, no other', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(
			answer({ dossiers: [hit('dossiers', 'a')] }, { partial: { dossiers: true } })
		);
		of('articles').answer(answer({ articles: [] }));
		of('judgments').answer(answer({ judgments: [] }, { partial: { judgments: true } }));
		await settle();
		// The judgments were asked in full: there is no more to ask for.
		expect([...s.moreKinds]).toEqual(['dossiers']);
		expect(s.empty).toBe(false);
		const before = asked.length;
		s.askInFull();
		flushSync();
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.slice(before).map((a) => [a.query.types[0], a.query.mode])).toEqual([
			['instruments', 'full']
		]);
		expect(s.moreKinds.size).toBe(0);
		stop();
	});

	it('asks in full by itself where the live mode left kinds out and found nothing in them', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'huur');
		of('instruments').answer(answer({ instruments: [] }, { partial: { instruments: true } }));
		await settle();
		expect(s.fullFor).toBe('huur');
		await vi.advanceTimersByTimeAsync(150);
		expect(asked.at(-1)?.query.mode).toBe('full');
		expect(asked.at(-1)?.query.types).toContain('instruments');
		stop();
	});

	it('waits for the answers in full where it asks in full by itself (#118)', async () => {
		const { asked, of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huur');
		of('articles').answer(answer({ articles: [hit('articles', 'live', 1)] }));
		of('judgments').answer(answer({ judgments: [] }));
		await settle();
		of('instruments').answer(
			answer({ instruments: [] }, { resolved: null, partial: { instruments: true } })
		);
		await settle();
		expect(s.fullFor).toBe('huur');
		// The fast lane asked again, in full: the lanes are not in until that answer is, also
		// while it waits. The text and the judgments, asked in full at once, are not asked twice.
		expect(s.allIn).toBe(false);
		s.pressEnter();
		await settle();
		expect(opened).toEqual([]);
		await vi.advanceTimersByTimeAsync(150);
		flushSync();
		expect(s.allIn).toBe(false);
		expect(asked.filter((a) => a.query.types.includes('articles'))).toHaveLength(1);
		of('instruments').answer(
			answer({ instruments: [hit('instruments', 'huurwet', 2)] }, { resolved: null })
		);
		await settle();
		// A field without a page of results: the first row stands chosen, a second Enter opens it.
		expect(s.isActive(0)).toBe(true);
		expect(opened).toEqual([]);
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
		expect(s.isActive(0)).toBe(true);
		expect(opened).toEqual([]);
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
	it('chooses the first row once every answer is in, for an Enter before the answer (#79)', async () => {
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
		expect(s.isActive(0)).toBe(true);
		expect(opened).toEqual([]);
		s.pressEnter();
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
		expect(s.notFound).toBe(true);
		expect(s.citation).toBe(null);
		expect(s.rowCount).toBe(0);
		s.pressEnter();
		await settle();
		expect(opened).toEqual([]);
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

describe('Enter with nothing chosen (Thijs, 5 Nov; besluit 30)', () => {
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

	const ARTICLE = { ...hit('articles', 'bwbr0005289_boek6_art162'), exact: true };

	const CITED = {
		resolved: {
			match: {
				kind: 'article',
				collection: 'articles',
				key: 'bwbr0005289_boek6_art162'
			},
			notation: { kind: 'article', value: '6:162 BW' }
		}
	};

	it('opens a citation the API recognises, and it stands chosen for that', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, '6:162 BW');
		of('instruments').answer(answer({ instruments: [] }, CITED));
		await settle();
		expect(s.isActive(0)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual([{ collection: 'articles', key: 'bwbr0005289_boek6_art162' }]);
		expect(results).toEqual([]);
		stop();
	});

	it('an Enter before the answer waits for it where the query holds a digit', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, '6:162 BW');
		s.pressEnter();
		expect(results).toEqual([]);
		of('instruments').answer(answer({ instruments: [] }, CITED));
		await settle();
		expect(opened).toEqual([{ collection: 'articles', key: 'bwbr0005289_boek6_art162' }]);
		expect(results).toEqual([]);
		stop();
	});

	it('says that Enter waits until the answer is in, for a query with a digit (B117)', async () => {
		const { of } = api();
		const { s, stop } = session(undefined, true);
		await type(s, '6:162 BW');
		expect(s.enterWaits).toBe(true);
		of('instruments').answer(answer({ instruments: [] }, CITED));
		await settle();
		expect(s.enterWaits).toBe(false);
		await type(s, 'politiewet');
		expect(s.enterWaits).toBe(false);
		stop();
	});

	it('a citation that does not exist goes to the page of results, also after waiting', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, '6:9999 BW');
		s.pressEnter();
		expect(results).toEqual([]);
		of('instruments').answer(
			answer(
				{ instruments: [] },
				{ resolved: { match: null, notation: { kind: 'article', value: '6:9999 BW' } } }
			)
		);
		await settle();
		expect(s.notFound).toBe(true);
		expect(s.rowCount).toBe(0);
		expect(results).toEqual(['6:9999 BW']);
		expect(opened).toEqual([]);
		stop();
	});

	it('a failed answer does not hold an Enter with a digit', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, '36764');
		s.pressEnter();
		of('instruments').answer(fail(500));
		await settle();
		expect(results).toEqual(['36764']);
		expect(opened).toEqual([]);
		stop();
	});

	it('a digit too short to ask about goes to the page of results at once', async () => {
		api();
		const { s, results, stop } = session(undefined, true);
		await type(s, '3');
		s.pressEnter();
		expect(results).toEqual(['3']);
		stop();
	});

	it('goes to the page of results for a hit the API names, and a chosen row opens', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'artikel 6:162 BW');
		await answerAll(of, { instruments: [] }, { best: ARTICLE.id }, { articles: [ARTICLE] });
		expect(s.isActive(0)).toBe(false);
		s.pressEnter();
		expect(results).toEqual(['artikel 6:162 BW']);
		expect(opened).toEqual([]);
		s.down();
		expect(s.isActive(0)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual([ARTICLE.id]);
		expect(results).toHaveLength(1);
		stop();
	});

	it('goes to the page of results before any answer is in', async () => {
		api();
		const { s, results, stop } = session(undefined, true);
		await type(s, 'huur');
		s.pressEnter();
		expect(results).toEqual(['huur']);
		stop();
	});

	const HUUR = [hit('instruments', 'huurwet'), hit('instruments', 'huurprijzen')];

	it('the pointer chooses nothing for Enter: it shows the row, Enter the page of results', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'huur');
		await answerAll(of, { instruments: HUUR }, { best: null });
		s.point(1);
		expect(s.isPointed(1)).toBe(true);
		expect(s.shownRow).toBe(1);
		expect(s.isActive(1)).toBe(false);
		expect(s.enterRow).toBe(null);
		s.pressEnter();
		expect(results).toEqual(['huur']);
		expect(opened).toEqual([]);
		stop();
	});

	it('takes back a row chosen with the keys, once the pointer moves', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'huur');
		await answerAll(of, { instruments: HUUR }, { best: null });
		s.down();
		s.point(1);
		expect(s.isActive(0)).toBe(false);
		s.pressEnter();
		expect(results).toEqual(['huur']);
		expect(opened).toEqual([]);
		stop();
	});

	it('↓ goes on from the row the pointer is on, and that one opens', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'huur');
		await answerAll(of, { instruments: HUUR }, { best: null });
		s.point(0);
		s.down();
		expect(s.isPointed(1)).toBe(false);
		expect(s.isActive(1)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual([HUUR[1].id]);
		expect(results).toEqual([]);
		stop();
	});

	it('a citation stays what Enter opens, with the pointer on another row', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, '6:162 BW');
		of('instruments').answer(answer({ instruments: HUUR }, CITED));
		await settle();
		s.point(2);
		expect(s.isPointed(2)).toBe(true);
		expect(s.isActive(0)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual([{ collection: 'articles', key: 'bwbr0005289_boek6_art162' }]);
		expect(results).toEqual([]);
		stop();
	});

	it('where there is no page of results the pointer does choose', async () => {
		const { of } = api();
		const { s, opened, stop } = session();
		await type(s, 'huur');
		await answerAll(of, { instruments: HUUR }, { best: null });
		s.point(1);
		expect(s.isActive(1)).toBe(true);
		expect(s.isPointed(1)).toBe(false);
		s.pressEnter();
		expect(opened).toEqual([HUUR[1].id]);
		stop();
	});

	describe('an answer that comes in after the choice', () => {
		// The fast lane is in, the text lane not: its group Artikelen holds a place above the
		// members, and its hits come in there (B117: no group comes in above before the fast one).
		const MEMBER_A = hit('members', 'a', 0);
		const MEMBER_B = hit('members', 'b', 0);
		const ARTICLE = hit('articles', 'art');

		/** The fast lane in, the articles still out, and ↓ on the row given. */
		async function chosenBeforeArticles(presses = 1) {
			const { of } = api();
			const session_ = session(undefined, true);
			await type(session_.s, 'huur');
			await vi.advanceTimersByTimeAsync(300);
			of('instruments').answer(answer({ members: [MEMBER_A, MEMBER_B] }, { resolved: null }));
			await settle();
			for (let n = 0; n < presses; n++) session_.s.down();
			flushSync();
			return { of, ...session_ };
		}

		it('Enter opens the bron that was chosen, in its new place', async () => {
			const { of, s, opened, results, stop } = await chosenBeforeArticles(2);
			expect(s.isActive(1)).toBe(true);
			of('articles').answer(answer({ articles: [ARTICLE] }));
			await settle();
			expect(s.isActive(2)).toBe(true);
			s.pressEnter();
			expect(opened).toEqual([MEMBER_B.id]);
			expect(results).toEqual([]);
			stop();
		});

		it('↓ goes on from the bron where it stands now', async () => {
			const { of, s, opened, stop } = await chosenBeforeArticles();
			of('articles').answer(answer({ articles: [ARTICLE] }));
			await settle();
			s.down();
			s.pressEnter();
			expect(opened).toEqual([MEMBER_B.id]);
			stop();
		});

		it('a bron that leaves the list leaves the choice: Enter the page of results', async () => {
			const { of, s, opened, results, stop } = await chosenBeforeArticles();
			of('articles').answer(answer({ articles: [ARTICLE] }));
			await settle();
			s.retry('fast');
			await vi.advanceTimersByTimeAsync(150);
			of('instruments').answer(answer({ members: [MEMBER_B] }, { resolved: null }));
			await settle();
			expect(s.enterRow).toBe(null);
			s.pressEnter();
			expect(results).toEqual(['huur']);
			expect(opened).toEqual([]);
			stop();
		});

		it('the row the pointer is on moves along, and still chooses nothing', async () => {
			const { of, s, opened, results, stop } = await chosenBeforeArticles(0);
			s.point(1);
			of('articles').answer(answer({ articles: [ARTICLE] }));
			await settle();
			expect(s.isPointed(2)).toBe(true);
			s.pressEnter();
			expect(results).toEqual(['huur']);
			expect(opened).toEqual([]);
			stop();
		});

		it('in a field that picks too', async () => {
			const { of } = api();
			const { s, opened, stop } = session();
			await type(s, 'huur');
			await vi.advanceTimersByTimeAsync(300);
			of('instruments').answer(answer({ members: [MEMBER_A, MEMBER_B] }, { resolved: null }));
			await settle();
			s.point(1);
			of('articles').answer(answer({ articles: [ARTICLE] }));
			await settle();
			expect(s.isActive(2)).toBe(true);
			s.pressEnter();
			expect(opened).toEqual([MEMBER_B.id]);
			stop();
		});
	});

	it('goes nowhere with nothing typed', () => {
		api();
		const { s, results, stop } = session(undefined, true);
		s.pressEnter();
		expect(results).toEqual([]);
		stop();
	});

	it('forgets the row chosen when the query changes', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'huur');
		await answerAll(of, { instruments: [hit('instruments', 'huurwet')] }, { best: null });
		s.down();
		await type(s, 'huurr');
		expect(s.isActive(0)).toBe(false);
		s.pressEnter();
		expect(results).toEqual(['huurr']);
		expect(opened).toEqual([]);
		stop();
	});

	it('a law by its abbreviation has no row above the groups: Enter the page of results', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'AVG');
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
		expect(s.bare).not.toBeNull();
		expect(s.lead).toBeNull();
		expect(s.rowCount).toBe(1);
		s.pressEnter();
		expect(results).toEqual(['AVG']);
		expect(opened).toEqual([]);
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

	it('goes to the page of results where nothing is found (T6)', async () => {
		const { of } = api();
		const { s, opened, results, stop } = session(undefined, true);
		await type(s, 'zzzzzz');
		await answerAll(of, { instruments: [] }, { best: null, matched: 'all' }, { articles: [] });
		s.pressEnter();
		expect(results).toEqual(['zzzzzz']);
		expect(opened).toEqual([]);
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
		expect(s.isActive(0)).toBe(false);
		s.pressEnter();
		expect(opened).toEqual([]);
		expect(s.isActive(0)).toBe(true);
		s.pressEnter();
		expect(opened).toEqual(['instruments/huurwet']);
		stop();
	});

	it('knows the hit the query names, for a word with a bron: the one exact over the lanes', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'kelderluik');
		await answerAll(
			of,
			{ instruments: [] },
			{ best: null },
			{ articles: [{ ...hit('articles', 'a'), exact: true }, hit('articles', 'b')] }
		);
		expect(s.named?.id).toBe('articles/a');
		// It stands in its own group, and is no row chosen.
		expect(s.shown.flatMap((g) => g.hits).map((h) => h.id)).toEqual(['articles/a', 'articles/b']);
		expect(s.isActive(0)).toBe(false);
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

describe('the order of the groups', () => {
	it('lifts a group with a whole name on its score once the fast lane is in, and the slow groups move none', async () => {
		const { of } = api();
		const { s, stop } = session();
		await type(s, 'yesilgoz');
		of('instruments').answer(
			answer({
				dossiers: [hit('dossiers', 'd', 0.1)],
				members: [hit('members', 'yesilgoz', 0.75)]
			})
		);
		await settle();
		const order = () => s.shown.map((x) => x.kind);
		expect(order()[0]).toBe('members');
		const before = order();
		of('articles').answer(answer({ articles: [hit('articles', 'a', 0.1)] }));
		await settle();
		// A slow group comes in under its place: the groups before it stand as they stood.
		expect(order().filter((k) => before.includes(k))).toEqual(
			before.filter((k) => order().includes(k))
		);
		expect(order()[0]).toBe('members');
		stop();
	});
});
