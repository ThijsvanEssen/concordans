// The one place that turns query params into an href and follows it. The address bar shows
// a node id's slash and a list's comma as they are: /explore?focus=articles/bwbr1_2&fase=a,b.
import { goto } from '$app/navigation';
import { BUNDLE_PARAM } from '$lib/map/page';

/** Params to set; `null`, `undefined`, `''` or `[]` removes the param, a list repeats it. */
export type ParamPatch = Record<string, string | readonly string[] | null | undefined>;

/** The query as the address bar shows it: `/` and `,` unescaped, the rest escaped. */
export const readableQuery = (params: URLSearchParams) =>
	params.toString().replaceAll('%2F', '/').replaceAll('%2C', ',');

/**
 * `path` with its query (left out when empty) and fragment (without `#`): the one way an href
 * gets its query, from params or from a patch (`{ q: 'x', van: null }`).
 */
export function queryHref(path: string, params: URLSearchParams | ParamPatch, hash = ''): string {
	const query = readableQuery(
		params instanceof URLSearchParams ? params : patchParams(new URLSearchParams(), params)
	);
	const fragment = new URL(`#${hash}`, 'http://x').hash;
	return `${path}${query ? `?${query}` : ''}${hash ? fragment : ''}`;
}

/** A copy of `params` with the `clear` params removed, then `patch` applied. */
export function patchParams(
	params: URLSearchParams,
	patch: ParamPatch,
	clear: readonly string[] = []
): URLSearchParams {
	const next = new URLSearchParams(params);
	for (const name of clear) next.delete(name);
	for (const [name, value] of Object.entries(patch)) {
		next.delete(name);
		for (const v of typeof value === 'string' ? [value] : (value ?? []))
			if (v) next.append(name, v);
	}
	return next;
}

/**
 * The href of `url` with its params patched (patchParams); no fragment unless given. The
 * bundel a reader keeps in (`?bundel=`) is this browser's: no href carries it on.
 */
export const withParams = (
	url: URL,
	patch: ParamPatch = {},
	{ clear = [], hash = '' }: { clear?: readonly string[]; hash?: string } = {}
) => queryHref(url.pathname, patchParams(url.searchParams, patch, [...clear, BUNDLE_PARAM]), hash);

/**
 * Follow `href` in place. A step (a filter) takes a history entry; typing or opening replaces
 * it. A navigation that fails is SvelteKit's to show (+error.svelte): nothing waits for it.
 */
export function navigate(href: string, { step = false } = {}): void {
	goto(href, { replaceState: !step, keepFocus: true, noScroll: true });
}

/** As `navigate`, for the caller that does something once the page has been drawn. */
export function navigateDone(href: string, { step = false } = {}): Promise<void> {
	return goto(href, { replaceState: !step, keepFocus: true, noScroll: true });
}

/** How long the typing pauses before the search text goes into the address. */
const QUERY_DELAY = 300;

/**
 * The filters of a list page in its address, one rule for Bladeren, Actueel and Zoeken (audit
 * dubbele helpers, 6). A filter is a step in the history; typing and opening replace it. Every
 * change drops the `clear` params (the open row, the page number) unless the patch sets them;
 * Wis alles drops `filters`. The search text goes in trimmed when the typing pauses, as
 * `toPatch` writes it.
 */
export function filterAddress(
	url: () => URL,
	{ clear, filters = [] }: { clear: readonly string[]; filters?: readonly string[] }
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const href = (patch: ParamPatch) => withParams(url(), patch, { clear });
	const patch = (p: ParamPatch, replace = false) => navigate(href(p), { step: !replace });
	return {
		href,
		patch,
		clearFilters: () => patch(Object.fromEntries(filters.map((f) => [f, null]))),
		typeQuery(text: string, toPatch: (t: string) => ParamPatch = (t) => ({ q: t || null })) {
			clearTimeout(timer);
			const t = text.trim();
			timer = setTimeout(
				() => {
					timer = undefined;
					patch(toPatch(t), true);
				},
				t ? QUERY_DELAY : 0
			);
		},
		/** Typed text waits for the pause, not yet in the address. */
		get typing() {
			return timer !== undefined;
		},
		stop: () => clearTimeout(timer)
	};
}
