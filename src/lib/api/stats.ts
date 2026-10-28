import { api, isTimeout, unwrap } from './client';
import type { Schema } from './types';
import { isAborted } from './errors';
import { onForget } from '$lib/util/forget';

/**
 * One answer for the page load, asked at most once at a time. The caller that starts it gives
 * its `signal` to the request, so leaving the page ends it; a caller that finds it under way
 * waits for it. A failure clears it (the next ask is a new request), and a request that gave
 * up on its time, or that the starter ended, is asked once more before it counts as failed.
 */
function sharedOnce<T>(get: (signal?: AbortSignal) => Promise<T>) {
	let request: Promise<T> | null = null;
	const start = (signal?: AbortSignal) => {
		const mine: Promise<T> = get(signal).catch((err) => {
			if (request === mine) request = null;
			throw err;
		});
		return (request = mine);
	};
	const ask = async (signal?: AbortSignal, again = true): Promise<T> => {
		try {
			return await (request ?? start(signal));
		} catch (err) {
			if (again && !signal?.aborted && (isTimeout(err) || isAborted(err)))
				return ask(signal, false);
			throw err;
		}
	};
	return { ask, forget: () => (request = null) };
}

export type Stats = Schema<'StatsResponse'>;

// The dataset changes by the day at most: one request per page load is enough.
const stats = sharedOnce((signal) => unwrap(api.GET('/api/stats', { signal })));

/** The number of bronnen per collection and of verbindingen per relation. */
export const getStats = (signal?: AbortSignal): Promise<Stats> => stats.ask(signal);

export type Coverage = Schema<'JudgmentCoverageResponse'>;

const coverage = sharedOnce((signal) => unwrap(api.GET('/api/stats/coverage', { signal })));

/** The judgments whose text is loaded, per court tier and per court, with their dates. */
export const getCoverage = (signal?: AbortSignal): Promise<Coverage> => coverage.ask(signal);

onForget(() => {
	stats.forget();
	coverage.forget();
});
