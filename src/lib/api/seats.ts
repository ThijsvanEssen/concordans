// An office (seat) over the names of its ministry, and the toezeggingen and dossiers its
// holder of the day made: the lists of the API filtered on `seat`.
import { api, unwrap } from './client';
import { once } from './records';

/** One office by any of its names: its holders, gaps and counts. */
export const getSeat = (seat: string) =>
	once(`seats/${seat}`, () => unwrap(api.GET('/api/seats/{seat}', { params: { path: { seat } } })));

/** The toezeggingen of the seat, newest made first. */
export const getSeatCommitments = (seat: string, limit: number, offset: number) =>
	once(`commitments?seat=${seat}&limit=${limit}&offset=${offset}`, () =>
		unwrap(api.GET('/api/commitments', { params: { query: { seat, limit, offset } } }))
	);

/** The dossiers whose first stuk its holder of the day signed, newest opened first. */
export const getSeatDossiers = (seat: string, limit: number, offset: number) =>
	once(`dossiers?seat=${seat}&limit=${limit}&offset=${offset}`, () =>
		unwrap(
			api.GET('/api/dossiers', {
				params: { query: { seat, limit, offset, sort: 'opened_on' } }
			})
		)
	);
