// Addresses of the network as it was (shared links, bookmarks): `mode=graph` was the canvas,
// `mode=text` the reader, `diepte` the depth of the old network. They are carried over to the
// werkplek Netwerk (`mode=netwerk`, the same bron or bronnen) or to the reader, not ignored
// (R3-I F4). `diepte` stays: the werkplek reads it (how far the surroundings reach).

/** What only the werkplek reads: a ?toon=netwerk with one of these is meant for it. */
const WERKPLEK_PARAMS = ['netwerk', 'uit', 'tussen', 'omgeving'];

/** The address as it reads today, or null when it already does. */
export function currentAddress(url: URL): URL | null {
	const p = url.searchParams;
	const mode = p.get('mode');
	// ?toon=netwerk draws the small network in Verbonden; with the netwerk's own params it asks
	// for the werkplek.
	const forWerkplek = p.get('toon') === 'netwerk' && WERKPLEK_PARAMS.some((n) => p.has(n));
	if (mode !== 'graph' && mode !== 'text' && !forWerkplek) return null;
	const next = new URL(url);
	if (forWerkplek) {
		next.searchParams.set('mode', 'netwerk');
		next.searchParams.delete('toon');
	}
	if (mode === 'graph') next.searchParams.set('mode', 'netwerk');
	else if (mode === 'text') next.searchParams.delete('mode');
	return next;
}
