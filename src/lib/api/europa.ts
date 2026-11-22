// What the page Europa asks: the three lists, each its own call, so the first paints on the
// cheapest and the rest fill in. The dossiers are found by the words of their title (the API
// has no filter for them): the Kamer names an EU proposal "EU-voorstel: …", a bill that
// transposes a directive "… ter implementatie van …".
import { api, unwrap } from './client';
import { once } from './records';

const ROWS = 6;

/** The EU proposals the Tweede Kamer has under its dossiers, the newest first. */
export const getEuProposals = (limit = ROWS) =>
	once(`europa/voorstellen/${limit}`, () =>
		unwrap(
			api.GET('/api/dossiers', {
				params: {
					query: { subject: 'EU-voorstel', status: 'open', sort: 'opened_on', limit, facets: false }
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
						subject: 'implementatie',
						kind: 'Wetgeving',
						status: 'all',
						sort: 'opened_on',
						limit,
						facets: false
					}
				}
			})
		)
	);

/** The newest judgments of the Court of Justice and the General Court. */
export const getCourtRulings = (limit = ROWS) =>
	once(`europa/hof/${limit}`, () =>
		unwrap(
			api.GET('/api/judgments', {
				params: { query: { tier: ['hvj_eu'], sort: 'date_desc', limit, facets: false } }
			})
		)
	);
