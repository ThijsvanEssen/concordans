// Addresses that moved: a list of Bladeren that was /explore?mode=index&kind=… is now at its
// own address (/wetten, B128). A key is a path with the query it must hold; the rest of the
// query and the fragment go along. One list for two readers, as spa-routes.json: the server
// reads the built copy, moved.json beside index.html, and answers a 301; the app moves the
// address in the bar before it reads it, when the server did not (hooks.client.ts).
import moved from './moved.json';

/** The keys as URLs, the one that holds the most first: a list's before the bare index. */
const MOVED = Object.entries(moved as Record<string, string>)
	.map(([from, to]) => ({ from: new URL(from, 'https://x'), to }))
	.sort((a, b) => b.from.search.length - a.from.search.length);

/** The fragment that puts the focus on the search field of the start page. */
export const SEARCH_FRAGMENT = 'zoeken';

const holds = (url: URL, from: URL) =>
	url.pathname.replace(/(.)\/$/, '$1') === from.pathname &&
	[...from.searchParams].every(([k, v]) => url.searchParams.get(k) === v);

/**
 * Where an address that moved is now, with the rest of its query and its fragment; null for
 * any other address.
 */
export function movedAddress(url: URL): string | null {
	const found = MOVED.find((m) => holds(url, m.from));
	if (!found) return null;
	const to = new URL(found.to, url);
	for (const [k, v] of url.searchParams)
		if (!found.from.searchParams.has(k)) to.searchParams.append(k, v);
	return `${to.pathname}${to.search}${url.hash || to.hash}`;
}
