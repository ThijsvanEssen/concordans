// The addresses of the bundels (decision 19): the overview at /bundels, a bundel's own page
// at /bundels/<id>, by its id, which stays when the bundel is renamed; the bundel itself
// never leaves the browser. The addresses of before (/gemarkeerd, /gemarkeerd/bundel?id=)
// move here, a shared link's fragment with them.

/** The overview of the bundels; a shared link opens it with its fragment (`#m=…`). */
export const BUNDLES_PATH = '/bundels';

/** The address of a bundel's own page. */
export const bundlePageHref = (m: { id: string }) => `${BUNDLES_PATH}/${encodeURIComponent(m.id)}`;

const OLD_OVERVIEW = /^\/gemarkeerd\/?$/;
const OLD_PAGE = /^\/gemarkeerd\/bundel\/?$/;

/** Where an address of before now is, with its fragment; null for any other address. */
export function movedAddress(url: URL): string | null {
	if (OLD_OVERVIEW.test(url.pathname)) return `${BUNDLES_PATH}${url.search}${url.hash}`;
	if (!OLD_PAGE.test(url.pathname)) return null;
	const id = url.searchParams.get('id');
	return `${id ? bundlePageHref({ id }) : BUNDLES_PATH}${url.hash}`;
}
