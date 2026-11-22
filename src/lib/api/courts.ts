import { api, unwrap } from './client';
import { ifExists } from './errors';
import { once } from './records';

/**
 * The court map of one year (default the newest): the arrondissement and the ressort of every
 * municipality. Null where the API holds no map yet (the CBS source has not run): a gap, not
 * an error.
 */
export const getCourtDistricts = (year?: number) =>
	once(`courts/districts/${year ?? 'newest'}`, () =>
		ifExists(unwrap(api.GET('/api/courts/districts', { params: { query: { year } } })))
	);
