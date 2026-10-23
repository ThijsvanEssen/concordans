// The Netwerk button of the top bar (besluit 36, 39): a tool, not a soort bron. On a bron it
// opens the werkplek with that bron as its beginning, or the netwerk kept in this browser with
// the bron as a proposal beside it (the page decides, it knows the bron's id); anywhere else
// it opens the werkplek, which begins with choosing a bron.
import { exploreUrl } from '$lib/bron/address';
import { hasFocus, modeOf, NETWORK_MODE } from '$lib/bron/href';
import { parseNetwerk } from '$lib/selection/netwerk';

/** The page the button leads to from the page at `url`. */
export function networkHref(url: URL): string {
	if (onNetwork(url)) return `${url.pathname}${url.search}`;
	if (!hasFocus(url)) return '/explore';
	const to = new URL(url);
	to.searchParams.set('mode', NETWORK_MODE);
	for (const name of ['tabel', 'toon', 'naast', 'paneel']) to.searchParams.delete(name);
	return `${to.pathname}${to.search}`;
}

/** The page is the werkplek, with a bron or without: the button shows pressed. */
export const onNetwork = (url: URL): boolean => modeOf(url) === 'graph';

/**
 * How many bronnen the netwerk holds that the button leads back to: the werkplek's own, or
 * the one kept in this browser (`kept`, bewaardAantal) anywhere else.
 */
export const networkCount = (url: URL, kept: number): number =>
	onNetwork(url) ? parseNetwerk(exploreUrl(url).searchParams).ids.length : kept;
