// The one place that turns query params into an href and follows it. The address bar shows
// a node id's slash and a list's comma as they are: /explore?focus=articles/bwbr1_2&fase=a,b.
import { goto } from '$app/navigation';

/** Params to set; `null`, `undefined` or `''` removes the param. */
export type ParamPatch = Record<string, string | null | undefined>;

/** The query as the address bar shows it: `/` and `,` unescaped, the rest escaped. */
export const readableQuery = (params: URLSearchParams) =>
	params.toString().replaceAll('%2F', '/').replaceAll('%2C', ',');

/** `path` with its query (left out when empty) and fragment (without `#`). */
export function queryHref(path: string, params: URLSearchParams, hash = ''): string {
	const query = readableQuery(params);
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
		if (value === null || value === undefined || value === '') next.delete(name);
		else next.set(name, value);
	}
	return next;
}

/** The href of `url` with its params patched (patchParams); no fragment unless given. */
export const withParams = (
	url: URL,
	patch: ParamPatch = {},
	{ clear = [], hash = '' }: { clear?: readonly string[]; hash?: string } = {}
) => queryHref(url.pathname, patchParams(url.searchParams, patch, clear), hash);

/** Follow `href` in place. A step (a filter) takes a history entry; typing or opening replaces it. */
export const navigate = (href: string, { step = false } = {}) =>
	goto(href, { replaceState: !step, keepFocus: true, noScroll: true });
