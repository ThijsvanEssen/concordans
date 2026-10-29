// The Leespaneel in the address: `?lees=articles/bwbr0052872_68.lid-1`, the article and the
// place in it that is cited. One parameter, so a link with it opens the panel at whoever gets it;
// several articles are comma-separated (`…_19,…_23.lid-1`), the panel shows them under each other.
// The fragment (`#lid-2`) stays the place in the reader; `?naast` stays the text under it.
import { patchParams, queryHref } from '$lib/util/address';

export const READ_PARAM = 'lees';

/** An article read in the panel: its node key and the part the reference names. */
export type ReadRef = { key: string; at: string | null };

/** The anchor of a part (`lid-1`, `lid-1-onder-b`, `onder-a`, `aanhef`), never a key's own dot. */
const PLACE = /\.((?:lid|onder)-[^.,]+|aanhef)$/;

/** The articles a `lees` value names, in its order; what is no article is left out. */
export function parseRead(value: string | null | undefined): ReadRef[] {
	if (!value) return [];
	return value.split(',').flatMap((part) => {
		const m = /^articles\/(.+)$/.exec(part.trim());
		if (!m) return [];
		const place = PLACE.exec(m[1]);
		const key = place ? m[1].slice(0, place.index) : m[1];
		return key ? [{ key, at: place?.[1] ?? null }] : [];
	});
}

/** The `lees` value of the articles, as `parseRead` reads it. */
export const readValue = (items: readonly ReadRef[]): string =>
	items.map((g) => `articles/${g.key}${g.at ? `.${g.at}` : ''}`).join(',');

/** The address with the panel on these articles; none takes it away. The rest of it stays. */
export const withRead = (url: URL, items: readonly ReadRef[]): string =>
	queryHref(
		url.pathname,
		patchParams(url.searchParams, { [READ_PARAM]: items.length ? readValue(items) : null }),
		url.hash.slice(1)
	);

/**
 * The route of an article in the API (`{bwb_id}/{article_number}`) from its node key: the key is
 * the law's identifier and the number joined by the first `_` (`bwbr0052872_68`,
 * `32016r0679_6`), and the route's number is what follows it (`address` in the API).
 */
export function articleRoute(key: string): { bwbId: string; articleNumber: string } | null {
	const i = key.indexOf('_');
	if (i <= 0 || i === key.length - 1) return null;
	return { bwbId: key.slice(0, i).toUpperCase(), articleNumber: key.slice(i + 1) };
}
