// The feed of the Kamers and the Staatsblad: Actueel, the start page and Onderwerpen.
import { api, clientFor, unwrap, type Wait } from './client';
import type { QueryOf } from './types';

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

/** The days of the feed counted, with the events that stand alone. */
export const getFeedSummary = (query: QueryOf<'/api/feed/summary'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/feed/summary', { params: { query }, signal }));

/** The feed counted per period. */
export const getFeedPeriods = (query: QueryOf<'/api/feed/periods'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/feed/periods', { params: { query }, signal }));
