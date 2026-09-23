// Names of instruments by id, filled as responses pass by. Anything that prints
// a law name (status bar, citation formats, graph labels) reads it through
// `instrumentMetaStore` or `getInstrumentMeta`.

import { writable, type Readable } from 'svelte/store';
import { api, unwrap } from './client';

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
	unwrap(api.GET('/api/instruments', { params: { query: { sort: 'article_count', limit: 200 } } }))
		.then(({ items }) => items.forEach(recordInstrument))
		.catch(() => {});
}
