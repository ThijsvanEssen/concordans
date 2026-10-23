// The Netwerk button of the top bar (besluit 36, 39): a tool, not a soort bron. On a bron it
// opens the werkplek with that bron as its beginning, or the netwerk kept in this browser with
// the bron as a proposal beside it (the page decides, it knows the bron's id); anywhere else
// it opens the werkplek, which begins with choosing a bron.
import { exploreUrl } from '$lib/bron/address';
import { hasFocus, modeOf, NETWORK_MODE } from '$lib/bron/href';
import { parseNetwerk } from '$lib/selection/netwerk';

/** The params of the werkplek alone: the text of the bron leaves them (the netwerk is kept). */
const WERKPLEK_PARAMS = ['mode', 'netwerk', 'uit', 'tussen', 'omgeving', 'weergave', 'kies'];

/**
 * The text of the bron the werkplek shows: its own address, or on /explore the bron marked,
 * else the first chosen one; none chosen, the start page. The place in the text (#) stays.
 */
function textHref(url: URL): string {
	const params = exploreUrl(url).searchParams;
	if (url.pathname !== '/explore') {
		const to = new URL(url);
		for (const name of WERKPLEK_PARAMS) to.searchParams.delete(name);
		return `${to.pathname}${to.search}${to.hash}`;
	}
	const id = params.get('kies') ?? params.get('focus') ?? parseNetwerk(params).ids[0];
	return id ? `/explore?focus=${encodeURIComponent(id)}${url.hash}` : '/';
}

/**
 * The page the button leads to from the page at `url`: a switch (Thijs, 23 Oct). From the text
 * of a bron it opens the werkplek with it; from the werkplek it goes back to the text, and the
 * netwerk kept in this browser opens again with it.
 */
export function networkHref(url: URL): string {
	if (onNetwork(url)) return textHref(url);
	if (!hasFocus(url)) return '/explore';
	const to = new URL(url);
	to.searchParams.set('mode', NETWORK_MODE);
	for (const name of ['tabel', 'toon', 'naast', 'paneel']) to.searchParams.delete(name);
	return `${to.pathname}${to.search}${to.hash}`;
}

/** The page is the werkplek, with a bron or without: the button shows pressed. */
export const onNetwork = (url: URL): boolean => modeOf(url) === 'graph';

/**
 * How many bronnen the netwerk holds that the button leads back to: the werkplek's own, or
 * the one kept in this browser (`kept`, bewaardAantal) anywhere else.
 */
export const networkCount = (url: URL, kept: number): number =>
	onNetwork(url) ? parseNetwerk(exploreUrl(url).searchParams).ids.length : kept;
