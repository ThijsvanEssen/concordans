import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, slow, type FakeRequest } from '$lib/test/fakeApi';
import type { BronRef } from '$lib/bron/href';
import type { SearchKind } from './lanes';
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
function session(kinds?: SearchKind[]) {
	const opened: (BronRef | string)[] = [];
	const s = new SearchSession((ref) => opened.push(ref));
	if (kinds) s.kinds = kinds;
	const stop = $effect.root(() => s.connect());
	flushSync();
	return { s, opened, stop };
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
		expect(s.shown.map((g) => [g.kind, g.wacht])).toEqual([
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

	it('says that the search took too long when the fast lane does, and asks it again', async () => {
		const { asked, of } = api();
		const { s, stop } = session();
		await type(s, 'hu');
		of('instruments').answer(slow());
		await settle();
		expect(s.failure).toEqual({ slow: true });
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

	it('opens "55 Gw" as the article the API confirms, also for an Enter before it', async () => {
		let confirm!: (v: unknown) => void;
		api({
			'/api/resolve': () => new Promise((r) => (confirm = r))
		});
		const { s, opened, stop } = session();
		await type(s, '55 Gw');
		expect(s.citation).toBe(null);
		s.pressEnter();
		confirm({
			match: { kind: 'article', key: 'bwbr0001840_55', display_name: 'Artikel 55 Grondwet' },
			qualifier: null
		});
		await settle();
		expect(s.bare?.ref).toEqual({ collection: 'articles', key: 'bwbr0001840_55' });
		expect(opened).toEqual([{ collection: 'articles', key: 'bwbr0001840_55' }]);
		stop();
	});

	it('opens an ECLI by what the search resolved, without asking again', async () => {
		const { of, fake } = api();
		const { s, opened, stop } = session();
		const ecli = 'ECLI:NL:HR:2019:2006';
		await type(s, ecli);
		expect(s.citation).toEqual({ kind: 'ecli', ecli });
		of('instruments').answer(
			answer(
				{},
				{ resolved: { match: { kind: 'judgment', key: 'ecli_nl_hr_2019_2006' }, qualifier: null } }
			)
		);
		await settle();
		s.pressEnter();
		await settle();
		expect(opened).toEqual([{ collection: 'judgments', key: 'ecli_nl_hr_2019_2006' }]);
		expect(fake.asked('/api/resolve')).toEqual([]);
		stop();
	});

	/** /api/lookup that knows only these dossiers by number. */
	const dossiers =
		(...known: string[]) =>
		(r: FakeRequest) => {
			const q = r.params.query as { kind: string; number: string };
			return q.kind === 'dossier' && known.includes(q.number)
				? { collection: 'dossiers', key: q.number.toLowerCase().replace('-', '_') }
				: fail(404);
		};

	it('opens "21501-31" as the dossier of that number, not a paper 31 of 21501', async () => {
		api({ '/api/lookup': dossiers('21501-31', '21501'), '/api/resolve': fail(404) });
		const { s, opened, stop } = session();
		await type(s, '21501-31');
		expect(s.citation).toEqual({ kind: 'dossier', number: '21501', document: '31' });
		s.pressEnter();
		await settle();
		await settle();
		expect(opened).toEqual([{ collection: 'dossiers', key: '21501_31', number: '21501-31' }]);
		stop();
	});

	it('opens "36327-999", a paper the data lacks, as its dossier', async () => {
		api({ '/api/lookup': dossiers('36327'), '/api/resolve': fail(404) });
		const { s, opened, stop } = session();
		await type(s, '36327-999');
		s.pressEnter();
		await settle();
		await settle();
		expect(opened).toEqual([{ collection: 'dossiers', key: '36327', number: '36327' }]);
		stop();
	});

	it('says a citation the data does not have where its row was', async () => {
		api({ '/api/lookup': fail(404), '/api/resolve': fail(404) });
		const { s, opened, stop } = session();
		await type(s, '99999');
		s.pressEnter();
		await settle();
		await settle();
		expect(opened).toEqual([]);
		expect(s.notFound).toBe(true);
		expect(s.citation).toBe(null);
		stop();
	});

	it('says that opening a citation failed, not that the data lacks it', async () => {
		api({ '/api/lookup': fail(500), '/api/resolve': fail(500) });
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { s, stop } = session();
		await type(s, '36327-3');
		await s.openCitation();
		expect(s.failure).toEqual({ slow: false });
		expect(s.notFound).toBe(false);
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
				{ resolved: { match: { kind: 'instrument', key: 'bwbr0040940' } } }
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
