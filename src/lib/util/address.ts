// The one place that turns query params into an href and follows it. The address bar shows
// a node id's slash and a list's comma as they are: /explore?focus=articles/bwbr1_2&fase=a,b.
import { goto } from '$app/navigation';

/** Params to set; `null`, `undefined`, `''` or `[]` removes the param, a list repeats it. */
export type ParamPatch = Record<string, string | readonly string[] | null | undefined>;

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
		next.delete(name);
		for (const v of typeof value === 'string' ? [value] : (value ?? []))
			if (v) next.append(name, v);
	}
	return next;
}

/** The href of `url` with its params patched (patchParams); no fragment unless given. */
export const withParams = (
	url: URL,
	patch: ParamPatch = {},
	{ clear = [], hash = '' }: { clear?: readonly string[]; hash?: string } = {}
) => queryHref(url.pathname, patchParams(url.searchParams, patch, clear), hash);

/**
 * Follow `href` in place. A step (a filter) takes a history entry; typing or opening replaces
 * it. A navigation that fails is SvelteKit's to show (+error.svelte): nothing waits for it.
 */
export function navigate(href: string, { step = false } = {}): void {
	goto(href, { replaceState: !step, keepFocus: true, noScroll: true });
}
