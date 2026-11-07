// A list of Bladeren at its own address (/wetten, /bladeren; $lib/bron/lists.ts) and a readable address
// of a bron (/uitspraken/ECLI:…, /wetten/…/artikel/…, /dossiers/…, /kamerstukken/…/…) are
// served by the Verkenner; see $lib/bron/address.ts. An address that moved
// ($lib/seo/moved.ts) is put in the bar as it is now by hooks.client.ts, before the app reads
// it.
import type { Reroute } from '@sveltejs/kit';
import { parsePad } from '$lib/bron/address';
import { isIndexPath } from '$lib/bron/lists';
// Every answer of the API keeps the addresses and titles it gives, on every page.
import '$lib/bron/kept-paths';

export const reroute: Reroute = ({ url }) =>
	isIndexPath(url.pathname) || parsePad(url.pathname) ? '/explore' : undefined;
