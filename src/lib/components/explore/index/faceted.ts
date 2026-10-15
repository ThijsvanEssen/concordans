// A list whose facets are counted apart from its rows: the first page asks the facets in a
// request of its own (one row, the same filters), beside the rows, which never wait for them
// (Thijs, 10 Oct: lazy). A later page asks only the rows. Counting takes the time of a search
// (slowApi, 30 s): cold, a period took 20 s (#80).
import { api, unwrap, slowApi } from '$lib/api/client';
import type { paths } from '$lib/api/generated/openapi-types';

/** The lists that count their facets on request (`facets=true`). */
export type FacetedPath =
	| '/api/instruments'
	| '/api/judgments'
	| '/api/dossiers'
	| '/api/documents'
	| '/api/commitments';

type Get<P extends FacetedPath> = paths[P]['get'];
/** The filters of a list, without the page and the facets this module sets. */
type ListQuery<P extends FacetedPath> = Omit<
	NonNullable<Get<P>['parameters']['query']>,
	'offset' | 'facets'
>;
type ListPage<P extends FacetedPath> = Get<P>['responses'][200]['content']['application/json'];

/** The facets of a list as its answer gives them. */
export type FacetsOf<P extends FacetedPath> = ListPage<P>['facets'];

/** Asks the facets beside the rows and keeps what comes, or says why nothing came. */
export type FacetsApart = <T>(
	ask: () => Promise<T>,
	set: (answer: T) => void,
	signal: AbortSignal
) => void;

const getList = <P extends FacetedPath>(
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

/**
 * The rows of a faceted list from `offset`; on the first page its facets to `setFacets`,
 * asked apart (`apart`).
 */
export function faceted<P extends FacetedPath>(
	path: P,
	query: ListQuery<P>,
	apart: FacetsApart,
	setFacets: (answer: ListPage<P>) => void
): (offset: number, signal: AbortSignal) => Promise<ListPage<P>> {
	return (offset, signal) => {
		if (!offset)
			apart(
				() => getList(path, { ...query, offset: 0, limit: 1, facets: true }, signal),
				setFacets,
				signal
			);
		return getList(path, { ...query, offset, facets: false }, signal);
	};
}
