// Shared cache of human-readable instrument metadata.
//
// The backend is in transition: today the bulk endpoint returns a placeholder
// "BWB-regeling {bwb_id}" as the title; once it ships proper metadata
// (`citation_title`, `short_title`, `official_title` on the instrument and/or
// each article) this module surfaces it without further changes elsewhere.
//
// Anywhere we want to print a friendly law name (status bar breadcrumb,
// citation copy formats, etc.) reads through `getInstrumentMeta(bwbId)` and
// renders whichever field is most appropriate.

import { writable, type Readable } from 'svelte/store';

export type InstrumentMeta = {
	bwbId: string;
	/** Full official title, e.g. "Wetboek van Strafrecht". */
	title: string | null;
	/** Short citation form, e.g. "Sr". */
	shortTitle: string | null;
	/** Full citation form (often == title). */
	citationTitle: string | null;
	validFrom: string | null;
};

const PLACEHOLDER_TITLE_RE = /^bwb[-\s]?regeling\b/i;
// The backend currently appends concatenated valid-from dates to the title
// without a separator (e.g. "Wetboek van Strafrecht18813503-03-1881..."). We
// truncate at the first 4-digit run that immediately follows a letter, since
// that's never legitimate inside a Dutch law's name.
const TRAILING_DATE_RE = /(?<=[A-Za-zàâäéèêëîïôöùûüç])\d{4}.*$/;

function cleanTitle(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	let trimmed = value.trim();
	if (!trimmed) return null;
	if (PLACEHOLDER_TITLE_RE.test(trimmed)) return null;
	trimmed = trimmed.replace(TRAILING_DATE_RE, '').trim();
	if (!trimmed) return null;
	return trimmed;
}

const cache = new Map<string, InstrumentMeta>();
const store = writable<Map<string, InstrumentMeta>>(cache);

function flush() {
	// Emit a new Map reference so subscribers actually re-run.
	store.set(new Map(cache));
}

/**
 * Merge instrument metadata into the cache. Accepts any shape — we sniff for
 * the most useful fields and ignore the placeholder `BWB-regeling …`.
 *
 * Source candidates we look at, in priority order:
 *   citation_title / aanhaling      → citationTitle
 *   short_title / citeertitel_kort  → shortTitle
 *   official_title / title          → title
 */
export function recordInstrument(input: {
	bwb_id?: string | null;
	bwbId?: string | null;
	/** Instrument key — used as cache ID for EU instruments that have no bwb_id. */
	key?: string | null;
	title?: unknown;
	display_name?: unknown;
	citation_title?: unknown;
	official_title?: unknown;
	short_title?: unknown;
	aanhaling?: unknown;
	citeertitel?: unknown;
	citeertitel_kort?: unknown;
	geldig_vanaf?: unknown;
	validFrom?: unknown;
}): void {
	// For EU instruments bwb_id is null; fall back to the instrument key so that
	// getInstrumentMeta(celex) can find metadata cached via loadInstrument.
	const bwbId = String(input.bwb_id ?? input.bwbId ?? input.key ?? '').trim();
	if (!bwbId) return;

	const existing = cache.get(bwbId) ?? {
		bwbId,
		title: null,
		shortTitle: null,
		citationTitle: null,
		validFrom: null
	};

	const next: InstrumentMeta = {
		bwbId,
		title:
			cleanTitle(input.official_title) ??
			cleanTitle(input.title) ??
			cleanTitle(input.display_name) ??
			existing.title,
		shortTitle:
			cleanTitle(input.short_title) ?? cleanTitle(input.citeertitel_kort) ?? existing.shortTitle,
		citationTitle:
			cleanTitle(input.citation_title) ??
			cleanTitle(input.aanhaling) ??
			cleanTitle(input.citeertitel) ??
			existing.citationTitle,
		validFrom:
			(typeof input.geldig_vanaf === 'string' && input.geldig_vanaf) ||
			(typeof input.validFrom === 'string' && input.validFrom) ||
			existing.validFrom
	};

	// Backfill cross-fields when the backend supplies only one form.
	if (!next.citationTitle && next.title) next.citationTitle = next.title;
	if (!next.title && next.citationTitle) next.title = next.citationTitle;

	cache.set(bwbId, next);
	flush();
}

export function getInstrumentMeta(bwbId: string | null | undefined): InstrumentMeta | null {
	if (!bwbId) return null;
	return cache.get(bwbId) ?? null;
}

export const instrumentMetaStore: Readable<Map<string, InstrumentMeta>> = {
	subscribe: store.subscribe
};

// Background-fetch /api/nodes/instruments/{bwb} the first time a given BWB id
// is asked about. Once the response arrives, recordInstrument fires and any
// component reading from instrumentMetaStore re-renders with the full title.
// Once-per-bwb so a wet with hundreds of cross-references doesn't fire
// hundreds of calls. Best-effort: failures don't block UI.
//
// _enriching tracks bwbs we've already tried; we never retry a bwb in the
// same session, success OR failure. Previously the catch deleted from the
// set, which meant every appearance of a 404-ing bwb (e.g. an article whose
// instrument record is missing from the `instruments` collection) re-fired
// the same doomed call and spammed the console with the same 404. Sticky
// failure keeps the noise to one log line per bwb per session.
const _enriching = new Set<string>();
export function ensureInstrumentMeta(bwbId: string | null | undefined): void {
	if (!bwbId) return;
	const upper = bwbId.toUpperCase();
	if (_enriching.has(upper)) return;
	const cached = getInstrumentMeta(upper);
	if (cached?.title || cached?.citationTitle) return;
	_enriching.add(upper);
	// Lazy import to avoid a circular dependency with $lib/api/nodes.
	import('./nodes')
		.then(({ getNodeGraph }) => getNodeGraph('instruments', upper.toLowerCase()))
		.then((resp) => {
			const props = (resp.node?.props ?? {}) as Record<string, unknown>;
			recordInstrument({
				bwb_id: upper,
				display_name: resp.node?.display_name ?? null,
				title: props.title as string | null | undefined,
				citation_title: props.citation_title as string | null | undefined,
				short_title: props.short_title as string | null | undefined
			});
		})
		.catch(() => {
			/* sticky failure — keep _enriching marker so we don't retry */
		});
}
