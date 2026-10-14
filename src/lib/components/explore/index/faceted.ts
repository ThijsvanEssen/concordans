// A list whose facets are counted apart from its rows: the first page asks the facets in a
// request of its own (one row, the same filters), beside the rows, which never wait for them
// (Thijs, 10 Oct: lazy). A later page asks only the rows. Counting takes the time of a search
// (zoekApi, 30 s): cold, a period took 20 s (#80).
import { api, unwrap, zoekApi } from '$lib/api/client';
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
export type ListQuery<P extends FacetedPath> = Omit<
	NonNullable<Get<P>['parameters']['query']>,
	'offset' | 'facets'
>;
export type ListPage<P extends FacetedPath> =
	Get<P>['responses'][200]['content']['application/json'];

/** Loads the page from `offset` into the list; a newer load aborts `signal`. */
export type Fetcher = (offset: number, signal: AbortSignal) => Promise<void>;

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
			(query.facets ? zoekApi : api).GET as (
				p: P,
				init: object
			) => Promise<{ data?: ListPage<P>; response: Response }>
		)(path, {
			params: { query },
			signal
		})
	);

/**
 * The fetcher of a faceted list: its facets to `setFacets` (first page only, through `apart`),
 * its rows to `setRows`.
 */
export function faceted<P extends FacetedPath>(
	path: P,
	query: ListQuery<P>,
	apart: FacetsApart,
	setFacets: (answer: ListPage<P>) => void,
	setRows: (answer: ListPage<P>, offset: number, signal: AbortSignal) => void
): Fetcher {
	return async (offset, signal) => {
		if (!offset)
			apart(
				() => getList(path, { ...query, offset: 0, limit: 1, facets: true }, signal),
				setFacets,
				signal
			);
		setRows(await getList(path, { ...query, offset, facets: false }, signal), offset, signal);
	};
}
