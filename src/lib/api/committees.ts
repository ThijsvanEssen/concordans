import { api, unwrap } from './client';
import { once } from './records';
import type { QueryOf } from './types';

/** A committee by its slug (`/api/committees/{slug}`); its node key is a GUID. */
export const getCommittee = (slug: string) =>
	once(`committees/${slug}`, () =>
		unwrap(api.GET('/api/committees/{slug}', { params: { path: { slug } } }))
	);

/** The committees under `query`. */
export const getCommittees = (query: QueryOf<'/api/committees'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/committees', { params: { query }, signal }));
