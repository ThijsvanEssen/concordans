// A law of the Staatsblad that the BWB now holds: the API lets it go (normalize
// staatsblad-laws) and the server answers its addresses with a 301 to the same law, or the
// same article, in the BWB. Opened inside the app, such an address is asked of the server once,
// which sends it on; where the server served it itself, the page says what happened.

/** Whether an address names a law of the Staatsblad, or an article of it (./address). */
export const isEnactedLawPath = (pathname: string): boolean =>
	/^\/wetten\/STB-\d{4}-\d+(\/artikel\/[^/]+)?$/i.test(pathname);

/** What a page or a map says of a law of the Staatsblad that is gone from the data. */
export const MOVED_LAW = 'Vervangen door de geldende wet';

/**
 * Load the address from the server, which sends a law the BWB now holds on to it; true when
 * the page goes. Not where the document was served for this address already: then the server
 * had no other address for it.
 */
export function followServerMove(pathname: string): boolean {
	if (typeof location === 'undefined' || !isEnactedLawPath(pathname)) return false;
	const nav = performance.getEntriesByType?.('navigation')[0] as
		| PerformanceNavigationTiming
		| undefined;
	if (!nav || new URL(nav.name).pathname === pathname) return false;
	location.replace(pathname + location.search + location.hash);
	return true;
}
