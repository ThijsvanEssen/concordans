// A readable address of a bron (/uitspraken/ECLI:…, /wetten/…/artikel/…, /dossiers/…,
// /kamerstukken/…/…) is served by the Verkenner; see $lib/bron/address.ts.
import type { Reroute } from '@sveltejs/kit';
import { parsePad } from '$lib/bron/address';
// Every answer of the API keeps the addresses and titles it gives, on every page.
import '$lib/bron/kept-paths';

export const reroute: Reroute = ({ url }) => (parsePad(url.pathname) ? '/explore' : undefined);
