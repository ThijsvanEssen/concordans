// The feed of the Kamers and the Staatsblad: Actueel, the start page and Onderwerpen.
import { api, clientFor, slowApi, unwrap, type Wait } from './client';
import type { QueryOf } from './types';
import { untilCounted } from './counted';

/**
 * A page of the feed under `query`. It waits as long as the API does: a search of words or a
 * fractie can take seconds; `short` where the ordinary 10 s will do (a count, a short list).
 * `fresh` asks past the browser's cache: a `partial` answer is kept there for 60 s.
 */
export const getFeed = (
	query: QueryOf<'/api/feed'>,
	{
		signal,
		wait = 'long',
		fresh = false
	}: { signal?: AbortSignal; wait?: Wait; fresh?: boolean } = {}
) =>
	unwrap(
		clientFor(wait).GET('/api/feed', {
			params: { query },
			signal,
			...(fresh ? { cache: 'reload' as const } : {})
		})
	);

/**
 * The total and the facets of the feed under `query`: without them in 3 s the API answers
 * `partial` and counts on, asked again as every list asks (untilCounted).
 */
export const getFeedCounts = (query: QueryOf<'/api/feed'>, signal?: AbortSignal) =>
	untilCounted(
		(fresh) => getFeed({ ...query, limit: 1, facets: true }, { signal, wait: 'short', fresh }),
		(r) => !!r.partial && !r.facets,
		signal
	);

/** The days of the feed counted, with the events that stand alone; cold it takes seconds. */
export const getFeedSummary = (query: QueryOf<'/api/feed/summary'>, signal?: AbortSignal) =>
	unwrap(slowApi.GET('/api/feed/summary', { params: { query }, signal }));

/** The feed counted per period. */
export const getFeedPeriods = (query: QueryOf<'/api/feed/periods'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/feed/periods', { params: { query }, signal }));

/** When the Tweede Kamer last met and meets next, as of today: the summary's smallest answer. */
export const getChamberSchedule = (signal?: AbortSignal) =>
	getFeedSummary({ days: 1, limit: 1 }, signal).then((r) => r.chamber_schedule ?? null);
