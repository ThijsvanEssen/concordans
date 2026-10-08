// Names of instruments by id, filled as responses pass by. Anything that prints
// a law name (status bar, citation formats, graph labels) reads it through
// `instrumentMetaStore` or `getInstrumentMeta`.

import { writable, type Readable } from 'svelte/store';
import { api, unwrap } from './client';
import type { Schema } from './types';

export type InstrumentMeta = {
	/** BWB id, or the key of an instrument without one (EU). */
	bwbId: string;
	/** "Wetboek van Strafrecht" */
	title: string | null;
	/** "Sr" */
	shortTitle: string | null;
	citationTitle: string | null;
};

// Node props are untyped, so the fields may be anything.
const clean = (value: unknown) => (typeof value === 'string' && value.trim()) || null;

/** The id a law is grouped under: its BWB id, or its own key when it has none (EU). */
export function instrumentContainerId(input: { bwb_id?: unknown; key?: unknown }): string | null {
	return clean(input.bwb_id) ?? clean(input.key);
}

const cache = new Map<string, InstrumentMeta>();
const store = writable(cache);

// Many records arrive in one tick (a layer of thousands of instruments);
// subscribers should run once.
let flushQueued = false;
function flush() {
	if (flushQueued) return;
	flushQueued = true;
	queueMicrotask(() => {
		flushQueued = false;
		store.set(new Map(cache));
	});
}

/** Merges what a response says about an instrument. Fields the response lacks keep their value. */
export function recordInstrument(input: {
	bwb_id?: unknown;
	/** Id of an instrument without a BWB id. */
	key?: unknown;
	title?: unknown;
	display_name?: unknown;
	citation_title?: unknown;
	short_title?: unknown;
}): void {
	const bwbId = instrumentContainerId(input);
	if (!bwbId) return;

	const existing = cache.get(bwbId);
	const title = clean(input.title) ?? clean(input.display_name) ?? existing?.title ?? null;
	const citationTitle = clean(input.citation_title) ?? existing?.citationTitle ?? null;

	cache.set(bwbId, {
		bwbId,
		title: title ?? citationTitle,
		shortTitle: clean(input.short_title) ?? existing?.shortTitle ?? null,
		citationTitle: citationTitle ?? title
	});
	flush();
}

export function getInstrumentMeta(bwbId: string | null | undefined): InstrumentMeta | null {
	return bwbId ? (cache.get(bwbId) ?? null) : null;
}

export const instrumentMetaStore: Readable<Map<string, InstrumentMeta>> = {
	subscribe: store.subscribe
};

let primed = false;

/**
 * Loads the names of the 200 largest laws, once per session. They are the laws that
 * articles refer to most; one request replaces one request per law met on the canvas.
 * A law outside them keeps the name its own response carried.
 */
export function primeInstrumentNames(): void {
	if (primed) return;
	primed = true;
	// Not on the first view (110 kB): the browser asks it when it is idle, and until then a
	// law keeps the name its own response carried (Thijs, 9 Oct: "alles zo lazy mogelijk").
	const ask = () =>
		unwrap(
			api.GET('/api/instruments', { params: { query: { sort: 'article_count', limit: 200 } } })
		)
			.then(({ items }) => items.forEach(recordInstrument))
			.catch(() => {});
	if (typeof requestIdleCallback === 'function') requestIdleCallback(ask, { timeout: 3000 });
	else setTimeout(ask, 1500);
}

const details = new Map<string, Promise<Schema<'InstrumentDetailDTO'>>>();

/**
 * One instrument in full (`/api/instruments/{identifier}`): its names, dates, article count
 * and citations, asked for once per identifier. What it says of the names goes into the
 * cache, so a law outside the 200 of `primeInstrumentNames` is named too.
 */
export function getInstrumentDetail(identifier: string): Promise<Schema<'InstrumentDetailDTO'>> {
	let request = details.get(identifier);
	if (!request) {
		request = unwrap(api.GET('/api/instruments/{identifier}', { params: { path: { identifier } } }))
			.then((detail) => {
				recordInstrument(detail);
				return detail;
			})
			.catch((err) => {
				details.delete(identifier);
				throw err;
			});
		details.set(identifier, request);
	}
	return request;
}

/** Asks for an instrument's names when the cache has none: a fallback, not a first source. */
export function ensureInstrumentName(bwbId: string | null | undefined): void {
	if (!bwbId || cache.get(bwbId)?.title) return;
	getInstrumentDetail(bwbId).catch(() => {});
}
