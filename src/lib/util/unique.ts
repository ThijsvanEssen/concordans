// A keyed {#each} throws on a duplicate key and takes the page down with it. Lists the
// API gives (the dossiers of a publication, a page after a page) are not promised to be
// unique; they pass through here before they are drawn.

/**
 * The items with a key not seen before, the first of each, in their order. An item
 * whose key is null has none to compare and stays.
 */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string | null): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const k = key(item);
		if (k === null) return true;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}
