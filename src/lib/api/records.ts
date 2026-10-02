// The record of one bron, asked once. The reader, the panel Verbonden, a card and the
// table of contents of one bron ask for the same record, and a reader asks again when
// its bron is drawn anew with the same key: before this a dossier came three times,
// a lid, a stemming and a stuk twice. Nothing in the app writes, and the data changes
// once a day, so a record is kept for the session, the most recent ones only. A failed
// request is asked again next time (Opnieuw).
//
// A shared request takes no AbortSignal: one caller leaving must not cancel it for the
// others. A caller that leaves ignores the answer instead.
import { api, unwrap } from './client';

const MAX = 100;
const kept = new Map<string, Promise<unknown>>();

/** The answer of `load` for `id`, asked once while it is kept. */
export function once<T>(id: string, load: () => Promise<T>): Promise<T> {
	const hit = kept.get(id) as Promise<T> | undefined;
	if (hit) {
		// The most recently asked stays longest.
		kept.delete(id);
		kept.set(id, hit);
		return hit;
	}
	const request = load();
	request.catch(() => {
		if (kept.get(id) === request) kept.delete(id);
	});
	kept.set(id, request);
	if (kept.size > MAX) kept.delete(kept.keys().next().value!);
	return request;
}

/** For tests: forget every kept record. */
export const forgetRecords = () => kept.clear();

export const getMember = (key: string) =>
	once(`members/${key}`, () =>
		unwrap(api.GET('/api/members/{key}', { params: { path: { key } } }))
	);

/** The stukken a lid signed, as the neighbours of the lid. */
export const getMemberAuthored = (key: string) =>
	once(`members/${key}/authored`, () =>
		unwrap(
			api.GET('/api/nodes/{collection}/{key}', {
				params: {
					path: { collection: 'members', key },
					query: { relations: 'AUTHORED', limit: 200 }
				}
			})
		)
	);

export const getCommitment = (key: string) =>
	once(`commitments/${key}`, () =>
		unwrap(api.GET('/api/commitments/{key}', { params: { path: { key } } }))
	);

export const getDecision = (key: string) =>
	once(`decisions/${key}`, () =>
		unwrap(api.GET('/api/decisions/{key}', { params: { path: { key } } }))
	);

/** The stuk a stemming is about; null when the API has none. */
export const getDecisionDocument = (key: string) =>
	once(`decisions/${key}/document`, () =>
		api
			.GET('/api/decisions/{key}/document', { params: { path: { key } } })
			.then(({ data }) => data ?? null)
	);

export const getDocument = (key: string) =>
	once(`documents/${key}`, () =>
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key } } }))
	);

export const getCabinet = (key: string) =>
	once(`cabinets/${key}`, () =>
		unwrap(api.GET('/api/cabinets/{key}', { params: { path: { key } } }))
	);

export const getDossierTimeline = (number: string, limit: number) =>
	once(`dossiers/${number}/timeline/${limit}`, () =>
		unwrap(
			api.GET('/api/dossiers/{number}/timeline', {
				params: { path: { number }, query: { limit } }
			})
		)
	);

/** A bewindspersoon's toezeggingen, newest first; with `status`, only those in that state. */
export const getMemberCommitments = (key: string, limit: number, status?: string) =>
	once(`commitments?member=${key}&limit=${limit}&status=${status ?? ''}`, () =>
		unwrap(
			api.GET('/api/commitments', {
				params: { query: { member: key, limit, ...(status ? { status } : {}) } }
			})
		)
	);

/** The dossiers with stukken a lid signed; `total` counts them all. */
export const getMemberDossiers = (key: string, limit: number) =>
	once(`members/${key}/dossiers/${limit}`, () =>
		unwrap(api.GET('/api/members/{key}/dossiers', { params: { path: { key }, query: { limit } } }))
	);

/** The stukken that explain an article, the ten first; null when the API has none. */
export const getExplainedBy = (bwb: string, number: string) =>
	once(`articles/${bwb}/${number}/explained-by`, () =>
		api
			.GET('/api/articles/{bwb_id}/{article_number}/explained-by', {
				params: { path: { bwb_id: bwb, article_number: number }, query: { limit: 10 } }
			})
			.then(({ data }) => data ?? null)
	);
