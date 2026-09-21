// Names of instruments by id, filled as responses pass by. Anything that prints
// a law name (status bar, citation formats, graph labels) reads it through
// `instrumentMetaStore` or `getInstrumentMeta`.

import { writable, type Readable } from 'svelte/store';
import { getNodeGraph } from './nodes';

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
	const bwbId = clean(input.bwb_id) ?? clean(input.key);
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

// One request per instrument and session, also when it fails: an instrument
// that is missing would otherwise be asked for again at every appearance.
const asked = new Set<string>();

/** Fetches the short title of an instrument the first time it is asked for. */
export function ensureInstrumentMeta(bwbId: string | null | undefined): void {
	if (!bwbId) return;
	const id = bwbId.toUpperCase();
	if (asked.has(id) || getInstrumentMeta(id)?.shortTitle) return;
	asked.add(id);
	getNodeGraph('instruments', id, { neighborLimit: 1 })
		.then(({ node }) => {
			const { title, citation_title, short_title } = node.props ?? {};
			recordInstrument({
				bwb_id: id,
				display_name: node.display_name,
				title,
				citation_title,
				short_title
			});
		})
		.catch(() => {});
}
