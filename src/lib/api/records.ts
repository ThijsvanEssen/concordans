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
import { ifExists } from './errors';
import { volledig } from './limits';
import { getNodeGraph, neighborsOf, NODE_BUCKET } from './nodes';
import type { Collection } from '$lib/vocabulary';
import { onForget } from '$lib/util/forget';

// An article read through a law is a record too: room for a few hundred.
const MAX = 400;
const kept = new Map<string, Promise<unknown>>();
onForget(() => kept.clear());

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

/**
 * A shared request for one caller that may leave: the caller's answer rejects when its
 * signal aborts, while the request itself goes on for the others.
 */
export function abortable<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return request;
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise<T>((resolve, reject) => {
		const stop = () => reject(signal.reason);
		signal.addEventListener('abort', stop, { once: true });
		request.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
	});
}

/**
 * The node of a bron with its neighbours, 200 per bucket: what the canvas and the panel
 * Verbonden draw from, and what a reader can take its own bucket from (a lid's AUTHORED).
 */
export const getNode = (collection: Collection, key: string) =>
	once(`nodes/${collection}/${key.toLowerCase()}`, () =>
		getNodeGraph(collection, key, { limit: NODE_BUCKET })
	);

/**
 * The node of a bron with one neighbour per bucket: its own props and the count of every
 * bucket, in a fraction of the full node (the Awb: 13 kB against 4.9 MB). What a reader,
 * a card and the first view need; the canvas fills in from `getNode` after it.
 */
export const getNodeFirst = (collection: Collection, key: string) =>
	once(`nodes/${collection}/${key.toLowerCase()}/first`, () =>
		getNodeGraph(collection, key, { limit: 1, wait: 'short' })
	);

/**
 * The node of a bron as the canvas draws it: an ordinary bron draws at most 30 neighbours, so
 * 30 per bucket (39 kB against 162 for art. 3:4 Awb, prod 9 Oct). A container (a wet, a
 * dossier) draws all its members and asks `getNode`.
 */
export const CANVAS_BUCKET = 30;
export const getNodeCanvas = (collection: Collection, key: string) =>
	once(`nodes/${collection}/${key.toLowerCase()}/canvas`, () =>
		getNodeGraph(collection, key, { limit: CANVAS_BUCKET })
	);

/**
 * The hull of a wet as the canvas draws it: its articles alone (PART_OF), the only bronnen in
 * its hull; its other buckets are no member and not drawn (Awb on prod: 149 kB against 1.3 MB
 * for the same 200 articles). A dossier, fractie or commissie holds every neighbour in its
 * hull and keeps `getNode`.
 */
export const getNodeHull = (collection: Collection, key: string) =>
	collection === 'instruments'
		? once(`nodes/${collection}/${key.toLowerCase()}/hull`, () =>
				getNodeGraph(collection, key, {
					limit: NODE_BUCKET,
					relations: 'PART_OF',
					nodeTypes: 'article',
					direction: 'inbound'
				})
			)
		: getNode(collection, key);

/**
 * The node of a bron as Verbonden first draws it: the count of every bucket and the rows a
 * closed group shows (3), not the 200 per bucket (Yeşilgöz: 8 kB against 150 gzip, prod 9 Oct).
 * A group's own rows come when it is opened.
 */
export const VERBONDEN_BUCKET = 5;
export const getNodeVerbonden = (collection: Collection, key: string) =>
	once(`nodes/${collection}/${key.toLowerCase()}/verbonden`, () =>
		getNodeGraph(collection, key, { limit: VERBONDEN_BUCKET })
	);

/** How many records are kept. */
export const RECORDS_KEPT = MAX;

export const getMember = (key: string) =>
	once(`members/${key}`, () =>
		unwrap(api.GET('/api/members/{key}', { params: { path: { key } } }))
	);

/**
 * The stukken a lid signed: the AUTHORED bucket of the lid's own node, asked once; only the
 * bucket it reads, not the whole node (150 kB gzip).
 */
export const getMemberAuthored = (key: string) =>
	once(`nodes/members/${key.toLowerCase()}/authored`, () =>
		getNodeGraph('members', key, { limit: NODE_BUCKET, relations: 'AUTHORED' })
	).then(neighborsOf);

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
		ifExists(unwrap(api.GET('/api/decisions/{key}/document', { params: { path: { key } } })))
	);

/** One activity: its kind, day, committee, dossiers and moves (cheap; API 0.79.55). */
export const getActivity = (key: string) =>
	once(`activities/${key}`, () =>
		unwrap(api.GET('/api/activities/{key}', { params: { path: { key } } }))
	);

/** What was made in an activity: its record, motions, toezeggingen and stemmingen. */
export const getActivityRecords = (key: string) =>
	once(`activities/${key}/records`, () =>
		unwrap(api.GET('/api/activities/{key}/records', { params: { path: { key } } }))
	);

export const getDocument = (key: string) =>
	once(`documents/${key}`, () =>
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key } } }))
	);

export const getCabinet = (key: string) =>
	once(`cabinets/${key}`, () =>
		unwrap(api.GET('/api/cabinets/{key}', { params: { path: { key } } }))
	);

/** A cabinet's coalition seats in each Kamer over its period, a stretch per change. */
export const getCabinetSeats = (key: string) =>
	once(`cabinets/${key}/seats`, () =>
		unwrap(api.GET('/api/cabinets/{key}/seats', { params: { path: { key } } }))
	);

/** The hall of a Kamer on a day (today without one), with the cabinet then in office. */
export const getParliamentSeats = (chamber: 'TK' | 'EK', date?: string) =>
	once(`parliament/seats/${chamber}/${date ?? ''}`, () =>
		unwrap(
			api.GET('/api/parliament/seats', {
				params: { query: { chamber, ...(date ? { date } : {}) } }
			})
		)
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

/** The most dossiers of a lid any view shows: the panel Verbonden lists a hundred. */
const MEMBER_DOSSIERS = 100;

/**
 * The dossiers with stukken a lid signed, the first `limit`; `total` counts them all. One
 * request of a hundred serves the head of a bewindspersoon (3) and Verbonden (100).
 */
export const getMemberDossiers = (key: string, limit: number = MEMBER_DOSSIERS) =>
	once(`members/${key}/dossiers`, () =>
		unwrap(
			api.GET('/api/members/{key}/dossiers', {
				params: { path: { key }, query: { limit: MEMBER_DOSSIERS } }
			})
		)
	).then((found) => ({ ...found, items: found.items.slice(0, limit) }));

/** The publications that change a law, as many as the API gives (the Awb has 114): the group in Verbonden
 *  and the implementations of BE-58 share them. */
export const getAmendedBy = (bwb: string) =>
	once(`instruments/${bwb}/amended-by`, () =>
		unwrap(
			api.GET('/api/instruments/{bwb_id}/amended-by', {
				params: {
					path: { bwb_id: bwb },
					query: { limit: volledig('/api/instruments/{bwb_id}/amended-by') }
				}
			})
		)
	);

/**
 * The papers that explain an article, each with its passages about it (API 0.79.41, #478):
 * one request where the reader asked every paper's `/passages` in turn. Null where the API
 * does not have the article.
 */
export const getExplanations = (bwb: string, number: string) =>
	once(`articles/${bwb}/${number}/explanations`, () =>
		ifExists(
			unwrap(
				api.GET('/api/articles/{bwb_id}/{article_number}/explanations', {
					params: { path: { bwb_id: bwb, article_number: number } }
				})
			)
		)
	);

/**
 * The first hundred documents of a dossier, once: the panel Verbonden lists them per chamber,
 * and an article's reader finds its memorie there when no EXPLAINS edge names it (the dossier
 * of the wet that gave its text). Null for a dossier the data lacks, said as such.
 */
export const getDossierDocuments = (number: string) =>
	once(`dossiers/${number}/documents?limit=100`, () =>
		ifExists(
			unwrap(
				api.GET('/api/dossiers/{number}/documents', {
					params: { path: { number }, query: { limit: 100 } }
				})
			)
		)
	);

/** The stukken that explain an article, the first fifty; null where the API does not have
 *  the article. The reader and the panel Verbonden share it. */
export const getExplainedBy = (bwb: string, number: string) =>
	once(`articles/${bwb}/${number}/explained-by`, () =>
		ifExists(
			unwrap(
				api.GET('/api/articles/{bwb_id}/{article_number}/explained-by', {
					params: { path: { bwb_id: bwb, article_number: number }, query: { limit: 50 } }
				})
			)
		)
	);
