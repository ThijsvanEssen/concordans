import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import { createLoader, type LoadState } from './load.svelte';

/** A request per call that the test answers by hand, with the signal it was given. */
function requests<T>() {
	const asked: {
		key: string;
		signal: AbortSignal;
		resolve: (v: T) => void;
		reject: (e: unknown) => void;
	}[] = [];
	const fetch = (key: string, signal: AbortSignal) =>
		new Promise<T>((resolve, reject) => asked.push({ key, signal, resolve, reject }));
	return { asked, fetch };
}

function loader<T>() {
	const { asked, fetch } = requests<T>();
	const states: LoadState<T>[] = [];
	const l = createLoader(fetch, (s) => states.push(s), 'test');
	return { asked, states, l, last: () => states.at(-1) };
}

const settle = () => new Promise((r) => setTimeout(r));

afterEach(() => vi.restoreAllMocks());

describe('createLoader', () => {
	it('goes from loading to the data', async () => {
		const { asked, l, states } = loader<number>();
		l.load('a');
		asked[0].resolve(1);
		await settle();
		expect(states).toEqual([{ status: 'loading' }, { status: 'ready', data: 1 }]);
	});

	it('aborts the old key on a new one and drops its late answer', async () => {
		const { asked, l, last } = loader<string>();
		l.load('a');
		l.load('b');
		expect(asked[0].signal.aborted).toBe(true);
		expect(asked[1].signal.aborted).toBe(false);
		asked[1].resolve('b');
		asked[0].resolve('a');
		await settle();
		expect(last()).toEqual({ status: 'ready', data: 'b' });
	});

	it('keeps the answers in the order of the keys, whatever comes first', async () => {
		const { asked, l, last } = loader<string>();
		l.load('a');
		l.load('b');
		asked[0].resolve('a');
		await settle();
		expect(last()).toEqual({ status: 'loading' });
		asked[1].resolve('b');
		await settle();
		expect(last()).toEqual({ status: 'ready', data: 'b' });
	});

	it('keeps a failure as an error and reports it', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { asked, l, last } = loader<number>();
		l.load('a');
		const e = new ApiError(500, '/api/x');
		asked[0].reject(e);
		await settle();
		expect(last()).toEqual({ status: 'error', error: e });
		expect(warn).toHaveBeenCalledWith('test:', e);
	});

	it('takes a fetch that throws at once as a failure', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const e = new Error('kapot');
		const states: LoadState<number>[] = [];
		const l = createLoader<string, number>(
			() => {
				throw e;
			},
			(s) => states.push(s),
			'test'
		);
		l.load('a');
		await settle();
		expect(states.at(-1)).toEqual({ status: 'error', error: e });
	});

	it('says nothing when the request is aborted', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { asked, l, last } = loader<number>();
		l.load('a');
		asked[0].reject(new DOMException('weg', 'AbortError'));
		await settle();
		expect(last()).toEqual({ status: 'loading' });
		expect(warn).not.toHaveBeenCalled();
	});

	it('asks the same key again on retry after a failure', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { asked, l, states } = loader<number>();
		l.load('a');
		asked[0].reject(new ApiError(500, '/api/x'));
		await settle();
		l.retry();
		expect(asked[1].key).toBe('a');
		asked[1].resolve(2);
		await settle();
		expect(states.map((s) => s.status)).toEqual(['loading', 'error', 'loading', 'ready']);
	});

	it('aborts on stop and keeps the state it had', async () => {
		const { asked, l, states } = loader<number>();
		l.load('a');
		l.stop();
		expect(asked[0].signal.aborted).toBe(true);
		asked[0].resolve(1);
		await settle();
		l.retry();
		expect(asked).toHaveLength(1);
		expect(states).toEqual([{ status: 'loading' }]);
	});
});
