// A list whose facets are counted apart from its rows: the first page asks the facets in a
// request of its own (one row, the same filters), beside the rows, which never wait for them
// (Thijs, 10 Oct: lazy). A later page asks only the rows ($lib/api/lists).
import { getFacetedList, type FacetedPath, type ListPage, type ListQuery } from '$lib/api/lists';

/** Asks the facets beside the rows and keeps what comes, or says why nothing came. */
export type FacetsApart = <T>(
	ask: () => Promise<T>,
	set: (answer: T) => void,
	signal: AbortSignal
) => void;

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
				() => getFacetedList(path, { ...query, offset: 0, limit: 1, facets: true }, signal),
				setFacets,
				signal
			);
		return getFacetedList(path, { ...query, offset, facets: false }, signal);
	};
}
