// The search of every kind, which also says what a query cites (`resolve=true`).
import { api, clientFor, unwrap, type Wait } from './client';
import type { QueryOf } from './types';

/** The longest query the API searches (`q` of /api/search and /api/resolve, API 0.79.61). */
export const QUERY_MAX_LENGTH = 200;

/**
 * The hits of `query`. It waits as long as the API may (30 s): a cold path took longer than
 * the 10 s of the others (Thijs, 10 Oct); `short` for one hit asked on the side.
 */
export const search = (
	query: QueryOf<'/api/search'>,
	{ signal, wait = 'long' }: { signal?: AbortSignal; wait?: Wait } = {}
) => unwrap(clientFor(wait).GET('/api/search', { params: { query }, signal }));

/** The bron at a readable address (`/api/lookup`). */
export const lookup = (query: QueryOf<'/api/lookup'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/lookup', { params: { query }, signal }));
