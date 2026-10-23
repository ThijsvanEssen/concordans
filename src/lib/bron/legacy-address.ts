// Addresses of the network as it was (shared links, bookmarks): `mode=graph` was the canvas,
// `mode=text` the reader, `diepte` the depth of the old network. They are carried over to the
// werkplek Netwerk (`mode=netwerk`, the same bron or bronnen) or to the reader, not ignored
// (R3-I F4).

/** The address as it reads today, or null when it already does. */
export function currentAddress(url: URL): URL | null {
	const p = url.searchParams;
	const mode = p.get('mode');
	if (mode !== 'graph' && mode !== 'text' && !p.has('diepte')) return null;
	const next = new URL(url);
	if (mode === 'graph') next.searchParams.set('mode', 'netwerk');
	else if (mode === 'text') next.searchParams.delete('mode');
	next.searchParams.delete('diepte');
	return next;
}
