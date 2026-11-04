// The Netwerk button of the top bar (besluit 36, 39): a tool, not a soort bron. On a bron it
// opens the werkplek with that bron as its beginning, or with the netwerk the reader composed
// (kept in this browser) written into the address beside it; anywhere else it opens the
// werkplek, which begins with choosing a bron.
import { exploreHref, exploreUrl } from '$lib/bron/address';
import { hasFocus, modeOf, NETWORK_MODE } from '$lib/bron/href';
import { networkQuery, parseNetwerk, withRemoved, type Netwerk } from '$lib/selection/netwerk';
import { bewaarNetwerk, keptNetwerk } from '$lib/selection/bewaard.svelte';

/** The params of the werkplek alone: the text of the bron leaves them (the netwerk is kept). */
const WERKPLEK_PARAMS = ['mode', 'netwerk', 'uit', 'tussen', 'weergave', 'kies'];

/** The bron the lezer shows or opens (B85): the address's own, else the first chosen one. */
export const readerBron = (params: URLSearchParams): string | null =>
	params.get('focus') || parseNetwerk(params).ids[0] || null;

/** The werkplek draws its Omgeving as lanes; ?doek=sigma is the way back while sigma is still here. */
export const onLanes = (params: URLSearchParams): boolean => params.get('doek') !== 'sigma';

/**
 * The query of what is chosen: the netwerk of `query` and the bron of the lezer (`focus`), first
 * where the address does not name it. On the sigma canvas a bron alone is no netwerk: it stays
 * drawn as itself. On the lanes (`lanes`) it is a netwerk of one (B84): the button Netwerk and a
 * link with netwerk= draw the same.
 */
export function withReader(query: string, focus: string | false | null, lanes = false): string {
	const params = new URLSearchParams(query);
	const { ids } = parseNetwerk(params);
	if (!focus || (ids.length === 0 && !lanes) || ids.includes(focus)) return query;
	params.set('netwerk', [focus, ...ids].join(','));
	return params.toString();
}

/** What × on a chosen bron leaves: the netwerk, and where the lezer goes. */
type AfterRemoval = {
	netwerk: Netwerk;
	/** The bron of the lezer changes: the next one chosen. */
	next: string | null;
	/** It was the last: nothing to draw, the lezer stays on it and the page is its text. */
	read: boolean;
};

/**
 * × on `id` in the netwerk `n`, the page's own bron being `focus`. The bron of the lezer goes
 * and the lezer goes along; the last one left is the page's own bron alone, so no netwerk.
 */
export function afterRemoval(n: Netwerk, id: string, focus: string | null): AfterRemoval {
	const rest = withRemoved(n, id);
	const empty: Netwerk = { ids: [], uit: new Set() };
	const reader = focus || n.ids[0];
	if (id !== reader) {
		const readerAlone = focus && rest.ids.length === 1 && rest.ids[0] === focus;
		return { netwerk: readerAlone ? empty : rest, next: null, read: false };
	}
	if (rest.ids.length === 0) return { netwerk: empty, next: null, read: true };
	return {
		netwerk: focus && rest.ids.length === 1 ? empty : rest,
		next: rest.ids[0],
		read: false
	};
}

/**
 * The text of the bron the werkplek shows: its own address, or on /explore the bron of the
 * lezer; none chosen, the start page. The place in the text (#) stays.
 */
function textHref(url: URL): string {
	if (url.pathname !== '/explore') {
		const to = new URL(url);
		for (const name of WERKPLEK_PARAMS) to.searchParams.delete(name);
		return `${to.pathname}${to.search}${to.hash}`;
	}
	const id = readerBron(url.searchParams);
	return id ? exploreHref(new URLSearchParams({ focus: id }), url.hash) : '/';
}

/**
 * The page the button leads to from the page at `url`: a switch (Thijs, 23 Oct). From the text
 * of a bron it opens the werkplek with it; from the werkplek it goes back to the text, and the
 * netwerk kept in this browser opens again with it.
 */
export function networkHref(url: URL, kept: string | null = null): string {
	if (onNetwork(url)) return textHref(url);
	if (!hasFocus(url)) return '/explore';
	const to = new URL(url);
	to.searchParams.set('mode', NETWORK_MODE);
	// The netwerk the reader composed stands in the address the button leads to: a shared link
	// to a bron alone draws the bron alone.
	if (!parseNetwerk(to.searchParams).ids.length)
		for (const [name, value] of new URLSearchParams(kept ?? '')) to.searchParams.set(name, value);
	for (const name of ['tabel', 'soort', 'toon', 'naast', 'paneel']) to.searchParams.delete(name);
	return `${to.pathname}${to.search}${to.hash}`;
}

/** The page is the werkplek, with a bron or without: the button shows pressed. */
export const onNetwork = (url: URL): boolean => modeOf(url) === 'graph';

/**
 * How many bronnen the netwerk holds that the button leads back to: the werkplek's own, or
 * the one kept in this browser (`kept`) anywhere else, with the bron of the lezer counted. One
 * bron alone counts nothing, on the lanes too (B85).
 */
export function networkCount(url: URL, kept: string | null): number {
	const logical = exploreUrl(url);
	const query = onNetwork(url) ? logical.search : (kept ?? '');
	const chosen = withReader(query, logical.searchParams.get('focus'));
	return parseNetwerk(new URLSearchParams(chosen)).ids.length;
}

/** The way from the werkplek to the lezer: what is chosen is kept, so the way back brings it. */
export function keepNetwork(url: URL) {
	const logical = exploreUrl(url);
	const chosen = withReader(logical.search, logical.searchParams.get('focus'));
	const netwerk = parseNetwerk(new URLSearchParams(chosen));
	if (netwerk.ids.length > 0) bewaarNetwerk(networkQuery(netwerk));
}

/** What the button and the tab of a phone show at `url`: where it leads, pressed, the count. */
export const networkState = (url: URL) => ({
	href: networkHref(url, keptNetwerk()),
	pressed: onNetwork(url),
	count: networkCount(url, keptNetwerk())
});
