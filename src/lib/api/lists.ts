// The lists that count their facets on request (`facets=true`): one call for five paths.
// Counting takes the time of a search (slowApi, 30 s): cold, a period took 20 s (#80).
import { api, unwrap, slowApi } from './client';
import type { paths } from './generated/openapi-types';

/** The lists that count their facets on request (`facets=true`). */
export type FacetedPath =
	| '/api/instruments'
	| '/api/judgments'
	| '/api/dossiers'
	| '/api/documents'
	| '/api/commitments';

type Get<P extends FacetedPath> = paths[P]['get'];
/** The filters of a list, without the page and the facets this module sets. */
export type ListQuery<P extends FacetedPath> = Omit<
	NonNullable<Get<P>['parameters']['query']>,
	'offset' | 'facets'
>;
export type ListPage<P extends FacetedPath> =
	Get<P>['responses'][200]['content']['application/json'];

/** The facets of a list as its answer gives them. */
export type FacetsOf<P extends FacetedPath> = ListPage<P>['facets'];

/** A page of a faceted list; with its facets counted, as long as the API takes. */
export const getFacetedList = <P extends FacetedPath>(
	path: P,
	query: ListQuery<P> & { offset: number; limit?: number; facets: boolean },
	signal: AbortSignal
): Promise<ListPage<P>> =>
	// One call for five paths: openapi-fetch types a call per path, not per union of them.
	unwrap(
		(
			(query.facets ? slowApi : api).GET as (
				p: P,
				init: object
			) => Promise<{ data?: ListPage<P>; response: Response }>
		)(path, {
			params: { query },
			signal
		})
	);
