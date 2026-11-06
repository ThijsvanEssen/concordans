// /api/decisions counts its total and facets per set of filters, once per change of the data
// (API 0.79.41): the page shows at once; the counts are asked again until they come (counted).
import { api, unwrap } from './client';
import { freshInit, untilCounted } from './counted';
import type { operations } from './generated/openapi-types';

type Query = NonNullable<operations['list_decisions_api_decisions_get']['parameters']['query']>;
type Antwoord = Awaited<ReturnType<typeof besluiten>>;

export const besluiten = (query: Query, signal?: AbortSignal, fresh = false) =>
	unwrap(api.GET('/api/decisions', { params: { query }, signal, ...freshInit(fresh) }));

/**
 * A page after the first, or a page of a list nobody counts: without facets, so the API
 * counts nothing and never waits. Its total is null; a short page is the end.
 */
export const decisionsPage = (query: Query, offset: number, signal?: AbortSignal) =>
	besluiten({ ...query, offset, facets: false }, signal);

/** The total and facets were still being counted when this answer was made. */
export const nogTeTellen = (r: Pick<Antwoord, 'total' | 'partial'>) =>
	r.partial === true && r.total === null;

/**
 * The same question again until its counts come: the counted answer, or the last one still
 * counting after the last wait; null where it needed none.
 */
export const telling = async (r: Antwoord, query: Query, signal?: AbortSignal) =>
	nogTeTellen(r)
		? untilCounted((fresh) => besluiten(query, signal, fresh), nogTeTellen, signal, r)
		: null;

/** For a question that is about its counts (limit 1, the facets): the counted answer. */
export const geteld = (query: Query, signal?: AbortSignal): Promise<Antwoord> =>
	untilCounted((fresh) => besluiten(query, signal, fresh), nogTeTellen, signal);
