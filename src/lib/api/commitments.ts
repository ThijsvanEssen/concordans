import { api, unwrap } from './client';
import type { QueryOf } from './types';

/** The toezeggingen under `query`. */
export const getCommitments = (query: QueryOf<'/api/commitments'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/commitments', { params: { query }, signal }));
