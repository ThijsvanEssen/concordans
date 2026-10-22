// A readable address of a bron (/uitspraken/ECLI:…, /wetten/…/artikel/…, /dossiers/…,
// /kamerstukken/…/…) is served by the Verkenner; see $lib/bron/address.ts. An address of
// the bundels of before is served by its page of now ($lib/map/page.ts); on
// loading, hooks.client.ts puts the address of now in the bar.
import type { Reroute } from '@sveltejs/kit';
import { parsePad } from '$lib/bron/address';
import { movedAddress } from '$lib/seo/moved';
// Every answer of the API keeps the addresses and titles it gives, on every page.
import '$lib/bron/kept-paths';

export const reroute: Reroute = ({ url }) => {
	if (parsePad(url.pathname)) return '/explore';
	const moved = movedAddress(url);
	return moved ? new URL(moved, url).pathname : undefined;
};
