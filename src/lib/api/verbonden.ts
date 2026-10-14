// The lists the panel Verbonden reads beside the node of a bron, each asked once per
// session ($lib/api/records `once`): opened again, ordered back, or read by the reader too,
// a list is not asked again. A failed request is asked again next time (Opnieuw). A caller
// that may leave wraps the answer in `abortable`.
import { api, unwrap } from './client';
import { once } from './records';
import type { paths } from './generated/openapi-types';

type QueryOf<P extends keyof paths> = NonNullable<
	paths[P] extends { get: { parameters: { query?: infer Q } } } ? Q : never
>;

/** The laws a member or a fractie has worked on, with the number of their documents. */
export const getTouchedInstruments = (who: 'members' | 'factions', key: string) =>
	once(`${who}/${key}/touched-instruments`, () =>
		unwrap(
			who === 'members'
				? api.GET('/api/members/{key}/touched-instruments', { params: { path: { key } } })
				: api.GET('/api/factions/{key}/touched-instruments', { params: { path: { key } } })
		)
	);

export const getFactionDossiers = (key: string, limit: number) =>
	once(`factions/${key}/dossiers/${limit}`, () =>
		unwrap(api.GET('/api/factions/{key}/dossiers', { params: { path: { key }, query: { limit } } }))
	);

/** The dossiers under one Kamer number (`36000`): `36000-I`, `36000-II`, … */
export const getDossiersOfNumber = (number: string) =>
	once(`dossiers?number=${number}`, () =>
		unwrap(api.GET('/api/dossiers', { params: { query: { number } } }))
	);

/** The European and international links of a law; `limit` per kind, all without one. */
export const getEuLinks = (identifier: string, limit?: number) =>
	once(`instruments/${identifier}/eu-links/${limit ?? ''}`, () =>
		unwrap(
			api.GET('/api/instruments/{identifier}/eu-links', {
				params: { path: { identifier }, query: limit ? { limit } : {} }
			})
		)
	);

/** A page of the passages of judgments that cite an article. */
export const getCitedBy = (
	bwbId: string,
	articleNumber: string,
	query: QueryOf<'/api/articles/{bwb_id}/{article_number}/cited-by'>
) =>
	once(
		`articles/${bwbId}/${articleNumber}/cited-by/${query.sort ?? ''}/${query.offset ?? 0}/${query.limit ?? ''}`,
		() =>
			unwrap(
				api.GET('/api/articles/{bwb_id}/{article_number}/cited-by', {
					params: { path: { bwb_id: bwbId, article_number: articleNumber }, query }
				})
			)
	);

/** The changes of an article, enacted and proposed, each with its dossier and date. */
export const getLegislativeHistory = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}/legislative-history`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/legislative-history', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		)
	);

/** A page of the references from a law's articles that carry an aard. */
export const getRelationshipsWithAard = (law: string, limit: number, offset: number) =>
	once(`relationships/aard/${law}/${limit}/${offset}`, () =>
		unwrap(
			api.GET('/api/relationships/search', {
				params: { query: { exclude_type: 'cross_reference', law, limit, offset } }
			})
		)
	);

export const getRelatedInstruments = (bwbId: string, limit: number) =>
	once(`instruments/${bwbId}/related-instruments/${limit}`, () =>
		unwrap(
			api.GET('/api/instruments/{bwb_id}/related-instruments', {
				params: { path: { bwb_id: bwbId }, query: { limit } }
			})
		)
	);

export const getInstrumentDossiers = (bwbId: string) =>
	once(`instruments/${bwbId}/dossiers`, () =>
		unwrap(api.GET('/api/instruments/{bwb_id}/dossiers', { params: { path: { bwb_id: bwbId } } }))
	);

/** The judgments that cite a law, in an order, of one year where `year` names it. */
export const getInstrumentJudgments = (
	bwbId: string,
	query: QueryOf<'/api/instruments/{bwb_id}/judgments'>
) =>
	once(
		`instruments/${bwbId}/judgments/${query.limit ?? ''}/${query.sort ?? ''}/${query.year ?? ''}`,
		() =>
			unwrap(
				api.GET('/api/instruments/{bwb_id}/judgments', {
					params: { path: { bwb_id: bwbId }, query }
				})
			)
	);

/** The debates and hearings a committee leads, newest first. */
export const getCommitteeActivities = (slug: string, limit: number) =>
	once(`committees/${slug}/activities/${limit}`, () =>
		unwrap(
			api.GET('/api/committees/{slug}/activities', {
				params: { path: { slug }, query: { limit } }
			})
		)
	);

/** The list of committees: it changes rarely. */
export const getCommittees = () => once('committees', () => unwrap(api.GET('/api/committees')));
