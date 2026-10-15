// A list asked whole asks the largest page the API gives, as its schema says
// (virtual:api-limits), not a number of its own: a lower cap would be a 422.
import maxima from 'virtual:api-limits';
import type { paths } from './generated/openapi-types';

/** The routes whose answer is a page with a `limit`. */
type PagedPath = {
	[P in keyof paths]: paths[P] extends { get: { parameters: { query?: { limit?: unknown } } } }
		? P
		: never;
}[keyof paths];

/** The largest `limit` of `path`. */
export const volledig = (path: PagedPath): number => maxima[path];
