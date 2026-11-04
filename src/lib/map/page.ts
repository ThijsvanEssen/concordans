// The addresses of the bundels (decision 19): the overview at /bundels, a bundel's own page
// at /bundels/<id>, by its id, which stays when the bundel is renamed; the bundel itself
// never leaves the browser.

/** The overview of the bundels; a shared link opens it with its fragment (`#m=…`). */
export const BUNDLES_PATH = '/bundels';

/**
 * The address's parameter that opens a reader keeping in a bundel (Andere bron toevoegen on
 * its page): read once on arriving and taken out of the address, so no link carries it.
 */
export const BUNDLE_PARAM = 'bundel';

/** A copy of an address without the bundel a reader keeps in: what a shared link is. */
export function withoutBundle(url: URL): URL {
	const clean = new URL(url);
	clean.searchParams.delete(BUNDLE_PARAM);
	return clean;
}

/** The address of a bundel's own page. */
export const bundlePageHref = (m: { id: string }) => `${BUNDLES_PATH}/${encodeURIComponent(m.id)}`;
