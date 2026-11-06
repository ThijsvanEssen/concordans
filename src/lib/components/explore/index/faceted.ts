// A list whose facets are counted apart from its rows: the first page asks the facets in a
// request of its own (one row, the same filters), beside the rows, which never wait for them
// (Thijs, 10 Oct: lazy). A later page asks only the rows ($lib/api/lists). Facets still being
// counted are asked again until they come ($lib/api/counted).
import { untilCounted } from '$lib/api/counted';
import {
	facetsCounting,
	getFacetedList,
	type FacetedPath,
	type FacetsOf,
	type ListPage,
	type ListQuery
} from '$lib/api/lists';

/** Asks the facets beside the rows and keeps what comes, or says why nothing came. */
export type FacetsApart = <T>(
	ask: () => Promise<T>,
	set: (answer: T) => void,
	signal: AbortSignal
) => void;

/**
 * What a faceted list keeps beside its rows: the facets, and the total they came with, for
 * rows that came without one (asked before it was counted).
 */
export type Counted<P extends FacetedPath> = { facets: FacetsOf<P>; total: number | null };

/** The total of a faceted list where its rows came without one (`ListDef.total`). */
export const countedTotal = (state: Partial<Counted<FacetedPath>>) => state.total ?? null;

/**
 * The rows of a faceted list from `offset`; on the first page its facets and their total to
 * `set`, asked apart (`apart`).
 */
export function faceted<P extends FacetedPath>(
	path: P,
	query: ListQuery<P>,
	apart: FacetsApart,
	set: (counted: Counted<P>) => void
): (offset: number, signal: AbortSignal) => Promise<ListPage<P>> {
	return (offset, signal) => {
		if (!offset)
			apart(
				() =>
					untilCounted(
						(fresh) =>
							getFacetedList(path, { ...query, offset: 0, limit: 1, facets: true }, signal, fresh),
						facetsCounting,
						signal
					),
				(r) => set({ facets: r.facets ?? null, total: r.total ?? null } as Counted<P>),
				signal
			);
		return getFacetedList(path, { ...query, offset, facets: false }, signal);
	};
}
