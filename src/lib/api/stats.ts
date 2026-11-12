import { api, unwrap } from './client';
import type { Schema } from './types';
import { isSlow } from './errors';
import { abortable, onceFn } from './records';

/** `get`, asked once more when the first request gave up on its time or the API's (503, 504). */
const twice =
	<T>(get: () => Promise<T>) =>
	() =>
		get().catch((err) => (isSlow(err) ? get() : Promise.reject(err)));

export type Stats = Schema<'StatsResponse'>;

// The dataset changes by the day at most: one request per session is enough. A caller that
// leaves ends its own wait, not the request the others share.
const stats = onceFn(
	'stats',
	twice(() => unwrap(api.GET('/api/stats')))
);

/** The number of bronnen per collection and of verbindingen per relation. */
export const getStats = (signal?: AbortSignal): Promise<Stats> => abortable(stats(), signal);

export type Coverage = Schema<'JudgmentCoverageResponse'>;

const coverage = onceFn(
	'stats/coverage',
	twice(() => unwrap(api.GET('/api/stats/coverage')))
);

/** The judgments whose text is loaded, per court tier and per court, with their dates. */
export const getCoverage = (signal?: AbortSignal): Promise<Coverage> =>
	abortable(coverage(), signal);
