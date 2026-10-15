// A law's lists asked page by page (the reader of a whole law, the index), beside the whole
// list asked once (law-articles.ts) and the detail (instrument-cache.ts).
import { api, unwrap } from './client';
import type { QueryOf } from './types';

/** The laws under `query`. */
export const getInstruments = (query: QueryOf<'/api/instruments'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/instruments', { params: { query }, signal }));

/** A page of the articles of a law in force today. */
export const getInstrumentArticles = (
	bwb: string,
	query: QueryOf<'/api/instruments/{bwb_id}/articles'>,
	signal?: AbortSignal
) =>
	unwrap(
		api.GET('/api/instruments/{bwb_id}/articles', {
			params: { path: { bwb_id: bwb }, query },
			signal
		})
	);

/** A page of the articles of a law as they read on `day`. */
export const getInstrumentArticlesAt = (
	bwb: string,
	day: string,
	query: QueryOf<'/api/instruments/{bwb_id}/articles/at/{at_date}'>,
	signal?: AbortSignal
) =>
	unwrap(
		api.GET('/api/instruments/{bwb_id}/articles/at/{at_date}', {
			params: { path: { bwb_id: bwb, at_date: day }, query },
			signal
		})
	);

/** The versions of a law. */
export const getInstrumentVersions = (bwb: string, signal?: AbortSignal) =>
	unwrap(
		api.GET('/api/instruments/{bwb_id}/versions', { params: { path: { bwb_id: bwb } }, signal })
	);
