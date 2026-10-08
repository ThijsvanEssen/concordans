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
import { getNodeGraph, neighborsOf } from './nodes';
import type { Collection } from '$lib/vocabulary';

// An article read through a law is a record too: room for a few hundred.
const MAX = 400;
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
		getNodeGraph(collection, key, { limit: 1 })
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
					limit: 200,
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

/** The most the API gives per bucket of a node (API 0.5). */
export const NODE_BUCKET = 200;

/** For tests: forget every kept record. */
export const forgetRecords = () => kept.clear();

/** How many records are kept. */
export const RECORDS_KEPT = MAX;

export const getMember = (key: string) =>
	once(`members/${key}`, () =>
		unwrap(api.GET('/api/members/{key}', { params: { path: { key } } }))
	);

/** The stukken a lid signed, as the neighbours of the lid. */
/** The stukken a lid signed: the AUTHORED bucket of the lid's own node, asked once. */
// Only the bucket it reads (what the person signed), not the whole node (150 kB gzip).
export const getMemberAuthored = (key: string) =>
	once(`nodes/members/${key.toLowerCase()}/authored`, () =>
		getNodeGraph('members', key, { limit: NODE_BUCKET, relations: 'AUTHORED' })
	).then((node) => neighborsOf(node).filter((n) => n.relation === 'AUTHORED'));

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

/** The most dossiers of a lid any view shows: the panel Verbonden lists a hundred. */
export const MEMBER_DOSSIERS = 100;

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

/** The publications that change a law, up to 500 (the Awb has 114): the group in Verbonden
 *  and the implementations of BE-58 share them. */
export const getAmendedBy = (bwb: string) =>
	once(`instruments/${bwb}/amended-by`, () =>
		unwrap(
			api.GET('/api/instruments/{bwb_id}/amended-by', {
				params: { path: { bwb_id: bwb }, query: { limit: 500 } }
			})
		)
	);

/** The stukken that explain an article, the first fifty; null when the API has none. The
 *  reader and the panel Verbonden share it. */
export const getExplainedBy = (bwb: string, number: string) =>
	once(`articles/${bwb}/${number}/explained-by`, () =>
		api
			.GET('/api/articles/{bwb_id}/{article_number}/explained-by', {
				params: { path: { bwb_id: bwb, article_number: number }, query: { limit: 50 } }
			})
			.then(({ data }) => data ?? null)
	);
