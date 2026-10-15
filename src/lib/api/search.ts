// The search of every kind, and `/api/resolve`, which turns a citation into one bron.
import { api, clientFor, unwrap, type Wait } from './client';
import type { QueryOf } from './types';

/**
 * The hits of `query`. It waits as long as the API may (30 s): a cold path took longer than
 * the 10 s of the others (Thijs, 10 Oct); `short` for one hit asked on the side.
 */
export const search = (
	query: QueryOf<'/api/search'>,
	{ signal, wait = 'long' }: { signal?: AbortSignal; wait?: Wait } = {}
) => unwrap(clientFor(wait).GET('/api/search', { params: { query }, signal }));

/** The bron a citation names (API 0.5). */
export const resolve = (q: string) => unwrap(api.GET('/api/resolve', { params: { query: { q } } }));

/** The bron at a readable address (`/api/lookup`). */
export const lookup = (query: QueryOf<'/api/lookup'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/lookup', { params: { query }, signal }));
