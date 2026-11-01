// The Netwerk button of the top bar (besluit 36, 39): a tool, not a soort bron. On a bron it
// opens the werkplek with that bron as its beginning, or with the netwerk the reader composed
// (kept in this browser) written into the address beside it; anywhere else it opens the
// werkplek, which begins with choosing a bron.
import { exploreUrl } from '$lib/bron/address';
import { hasFocus, modeOf, NETWORK_MODE } from '$lib/bron/href';
import { parseNetwerk, withRemoved, type Netwerk } from '$lib/selection/netwerk';
import { keptNetwerk } from '$lib/selection/bewaard.svelte';

/** The params of the werkplek alone: the text of the bron leaves them (the netwerk is kept). */
const WERKPLEK_PARAMS = ['mode', 'netwerk', 'uit', 'tussen', 'weergave', 'kies'];

/** The bron the lezer shows or opens (B85): the address's own, else the first chosen one. */
export const lezerBron = (params: URLSearchParams): string | null =>
	params.get('focus') || parseNetwerk(params).ids[0] || null;

/**
 * The query of what is chosen: the netwerk of `query` and the bron of the lezer (`focus`), first
 * where the address does not name it. A bron alone is no netwerk: it stays drawn as itself.
 */
export function metLezer(query: string, focus: string | null): string {
	const params = new URLSearchParams(query);
	const { ids } = parseNetwerk(params);
	if (!focus || ids.length === 0 || ids.includes(focus)) return query;
	params.set('netwerk', [focus, ...ids].join(','));
	return params.toString();
}

/** What × on a chosen bron leaves: the netwerk, and where the lezer goes. */
type NaWeghalen = {
	netwerk: Netwerk;
	/** The bron of the lezer changes: the next one chosen. */
	naar: string | null;
	/** It was the last: nothing to draw, the lezer stays on it and the page is its text. */
	lezen: boolean;
};

/**
 * × on `id` in the netwerk `n`, the page's own bron being `focus`. The bron of the lezer goes
 * and the lezer goes along; the last one left is the page's own bron alone, so no netwerk.
 */
export function naWeghalen(n: Netwerk, id: string, focus: string | null): NaWeghalen {
	const rest = withRemoved(n, id);
	const leeg: Netwerk = { ids: [], uit: new Set() };
	const lezer = focus || n.ids[0];
	if (id !== lezer) {
		const alleenLezer = focus && rest.ids.length === 1 && rest.ids[0] === focus;
		return { netwerk: alleenLezer ? leeg : rest, naar: null, lezen: false };
	}
	if (rest.ids.length === 0) return { netwerk: leeg, naar: null, lezen: true };
	return {
		netwerk: focus && rest.ids.length === 1 ? leeg : rest,
		naar: rest.ids[0],
		lezen: false
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
	const id = lezerBron(url.searchParams);
	return id ? `/explore?focus=${encodeURIComponent(id)}${url.hash}` : '/';
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
 * the one kept in this browser (`kept`) anywhere else, with the bron of the lezer counted.
 */
export function networkCount(url: URL, kept: string | null): number {
	const logical = exploreUrl(url);
	const query = onNetwork(url) ? logical.search : (kept ?? '');
	const chosen = metLezer(query, logical.searchParams.get('focus'));
	return parseNetwerk(new URLSearchParams(chosen)).ids.length;
}

/** What the button and the tab of a phone show at `url`: where it leads, pressed, the count. */
export const networkState = (url: URL) => ({
	href: networkHref(url, keptNetwerk()),
	pressed: onNetwork(url),
	count: networkCount(url, keptNetwerk())
});
