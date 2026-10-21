import { api, unwrap } from './client';
import type { QueryOf } from './types';

/** The passages of a document on one article of a law. */
export const getDocumentPassages = (
	key: string,
	query: QueryOf<'/api/documents/{key}/passages'>,
	signal?: AbortSignal
) =>
	unwrap(
		api.GET('/api/documents/{key}/passages', {
			params: { path: { key }, query },
			signal
		})
	);

/** A bijlage of a law with its text. */
export const getAnnex = (key: string, signal?: AbortSignal) =>
	unwrap(api.GET('/api/annexes/{key}', { params: { path: { key } }, signal }));

/**
 * The motions of censure and of no confidence filed since `from` (API 0.80, #862), one page
 * without counts: open while their `outcome` is null.
 */
export const getConfidenceMotions = (from: string, signal?: AbortSignal) =>
	unwrap(
		api.GET('/api/documents', {
			params: {
				query: { motion_kind: 'censure,no_confidence', from, facets: false, limit: 20 }
			},
			signal
		})
	);
