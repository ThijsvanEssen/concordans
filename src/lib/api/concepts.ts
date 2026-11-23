import { api, slowApi, unwrap } from './client';
import { once } from './records';
import type { QueryOf } from './types';

/**
 * A concept kept by hand (the articles that make one doctrine, and what cites them), once
 * per session: the block under an article asks it, and so does the next article of the concept.
 */
export const getConcept = (key: string) =>
	once(`concepts/${key}`, () =>
		unwrap(api.GET('/api/concepts/{key}', { params: { path: { key } } }))
	);

/** A page of the judgments that cite any article of a concept, narrowed by the filters. */
export const getConceptJudgments = (
	key: string,
	query: QueryOf<'/api/concepts/{key}/judgments'> = {}
) =>
	once(
		`concepts/${key}/judgments/${query.sort ?? ''}/${query.offset ?? 0}/${query.limit ?? ''}/${query.court ?? ''}/${(query.tier ?? []).join(',')}/${query.year ?? ''}/${query.subject_area ?? ''}`,
		() => unwrap(slowApi.GET('/api/concepts/{key}/judgments', { params: { path: { key }, query } }))
	);

/** A page of the papers joined to any article of a concept, of one year if asked. */
export const getConceptDocuments = (
	key: string,
	query: QueryOf<'/api/concepts/{key}/documents'> = {}
) =>
	once(
		`concepts/${key}/documents/${query.offset ?? 0}/${query.limit ?? ''}/${query.year ?? ''}`,
		() => unwrap(slowApi.GET('/api/concepts/{key}/documents', { params: { path: { key }, query } }))
	);
