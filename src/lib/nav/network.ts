// The Netwerk button of the top bar (besluit 36, M2 variant b): a tool, not a soort bron. On a
// bron it opens that bron big on the canvas of Samenhang; anywhere else it opens the canvas
// without a bron, which begins with choosing one.
import { hasFocus, modeOf, NETWORK_MODE } from '$lib/bron/href';

/** The page the button leads to from the page at `url`. */
export function networkHref(url: URL): string {
	if (!hasFocus(url)) return '/explore';
	const to = new URL(url);
	to.searchParams.set('mode', NETWORK_MODE);
	// On a phone the Verkenner opens its Netwerk tab (read once and dropped).
	to.searchParams.set('paneel', 'netwerk');
	to.searchParams.delete('tabel');
	to.searchParams.delete('toon');
	return `${to.pathname}${to.search}`;
}

/** The page is the canvas of Samenhang, with a bron or without: the button shows pressed. */
export const onNetwork = (url: URL): boolean => modeOf(url) === 'graph';
