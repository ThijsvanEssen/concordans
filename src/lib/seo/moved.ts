// Addresses with no page of their own that a reader types: the bare collections of the
// readable addresses (/wetten, /uitspraken; /wetten/BWBR… is a bron) go to their list in
// Bladeren. One list for two readers, as
// spa-routes.json: the server reads the built copy, moved.json beside index.html, and answers
// a 301 (B17); the app moves the address in the bar before it reads it, when the server did not.
import moved from './moved.json';
import { movedBundleAddress } from '$lib/map/page';

const MOVED: Readonly<Record<string, string>> = moved;

/** The fragment that puts the focus on the search field of the start page. */
export const SEARCH_FRAGMENT = 'zoeken';

/**
 * Where an address that moved is now, with the query and the fragment it came with; null for
 * any other address.
 */
export function movedAddress(url: URL): string | null {
	const target = MOVED[url.pathname.replace(/(.)\/$/, '$1')];
	if (!target) return movedBundleAddress(url);
	const to = new URL(target, url);
	for (const [k, v] of url.searchParams) to.searchParams.append(k, v);
	return `${to.pathname}${to.search}${url.hash || to.hash}`;
}
