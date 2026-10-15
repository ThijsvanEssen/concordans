// Names of instruments by id, filled as responses pass by. Anything that prints
// a law name (citation formats, graph labels) reads it through
// `instrumentMetaStore` or `getInstrumentMeta`.

import { textOf } from '$lib/text/words';
import { lawShortName } from '$lib/text/bw';
import { writable, type Readable } from 'svelte/store';
import { api, unwrap } from './client';
import { INSTRUMENT_NAMES } from './first-pages';
import { once } from './records';
import type { Schema } from './types';
import { onForget } from '$lib/util/forget';

export type InstrumentMeta = {
	/** BWB id, or the key of an instrument without one (EU). */
	bwbId: string;
	/** "Wetboek van Strafrecht" */
	title: string | null;
	/** "Sr" */
	shortTitle: string | null;
	citationTitle: string | null;
};

/** The id a law is grouped under: its BWB id, or its own key when it has none (EU). */
export function instrumentContainerId(input: { bwb_id?: unknown; key?: unknown }): string | null {
	return textOf(input.bwb_id) ?? textOf(input.key);
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
	const title = textOf(input.title) ?? textOf(input.display_name) ?? existing?.title ?? null;
	const citationTitle = textOf(input.citation_title) ?? existing?.citationTitle ?? null;

	cache.set(bwbId, {
		bwbId,
		title: title ?? citationTitle,
		shortTitle: lawShortName(bwbId, textOf(input.short_title) ?? existing?.shortTitle),
		citationTitle: citationTitle ?? title
	});
	flush();
}

/**
 * The names an article's detail carries of its law, under the id the article names it by
 * (its BWB id, an EU act's CELEX): the reader and a map's item (MapInhoud) cite it by them.
 */
export function recordArticleLaw(
	lawId: string,
	instrument:
		| { title?: unknown; citation_title?: unknown; short_title?: unknown; display_name?: unknown }
		| null
		| undefined
): void {
	if (!instrument) return;
	recordInstrument({
		bwb_id: lawId,
		title: instrument.title,
		display_name: instrument.display_name,
		citation_title: instrument.citation_title,
		short_title: instrument.short_title
	});
}

/**
 * A law by its name: its citation title (a title where it has none, see recordInstrument),
 * else its short title, else `fallback`, mostly its id.
 */
export const lawName = <F extends string | null>(
	meta: InstrumentMeta | null | undefined,
	fallback: F
): string | F => meta?.citationTitle ?? meta?.shortTitle ?? fallback;

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
			api.GET('/api/instruments', {
				params: { query: { sort: 'article_count', limit: INSTRUMENT_NAMES } }
			})
		)
			.then(({ items }) => items.forEach(recordInstrument))
			.catch(() => {});
	if (typeof requestIdleCallback === 'function') requestIdleCallback(ask, { timeout: 3000 });
	else setTimeout(ask, 1500);
}

onForget(() => {
	cache.clear();
	store.set(new Map());
	primed = false;
});

/**
 * One instrument in full (`/api/instruments/{identifier}`): its names, dates, article count
 * and citations, asked for once per identifier. What it says of the names goes into the
 * cache, so a law outside the 200 of `primeInstrumentNames` is named too.
 */
export function getInstrumentDetail(identifier: string): Promise<Schema<'InstrumentDetailDTO'>> {
	return once(`instruments/${identifier}/detail`, () =>
		unwrap(api.GET('/api/instruments/{identifier}', { params: { path: { identifier } } })).then(
			(detail) => {
				recordInstrument(detail);
				return detail;
			}
		)
	);
}

/** Asks for an instrument's names when the cache has none: a fallback, not a first source. */
export function ensureInstrumentName(bwbId: string | null | undefined): void {
	if (!bwbId || cache.get(bwbId)?.title) return;
	getInstrumentDetail(bwbId).catch(() => {});
}
