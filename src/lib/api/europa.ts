// What the page Europa asks: the lists, each its own call, so the first paints on the
// cheapest and the rest fill in. The dossiers are found by what the API says of the EU
// (`eu`: a proposal has an `eu_ref`, a bill that transposes an act `implements`).
import { api, unwrap } from './client';
import { once } from './records';

const ROWS = 6;

/** The EU proposals the Tweede Kamer has under its dossiers, the newest first. */
export const getEuProposals = (limit = ROWS) =>
	once(`europa/voorstellen/${limit}`, () =>
		unwrap(
			api.GET('/api/dossiers', {
				params: {
					query: { eu: 'proposal', status: 'open', sort: 'opened_on', limit, facets: false }
				}
			})
		)
	);

/** The bills that transpose an EU act, the newest first, passed or not. */
export const getTransposingBills = (limit = ROWS) =>
	once(`europa/omzetting/${limit}`, () =>
		unwrap(
			api.GET('/api/dossiers', {
				params: {
					query: {
						eu: 'implementation',
						status: 'all',
						sort: 'opened_on',
						limit,
						facets: false
					}
				}
			})
		)
	);

/** The newest preliminary rulings of the Court of Justice on questions of a Dutch court. */
export const getDutchCases = (limit = ROWS) =>
	once(`europa/nederland/${limit}`, () =>
		unwrap(
			api.GET('/api/judgments', {
				params: {
					query: { tier: ['hvj_eu'], referred_by: 'NL', sort: 'date_desc', limit, facets: false }
				}
			})
		)
	);
