// A readable address of a bron (/uitspraken/ECLI:…, /wetten/…/artikel/…, /dossiers/…,
// /kamerstukken/…/…) is served by the Verkenner; see $lib/bron/leesbaar.ts.
import type { Reroute } from '@sveltejs/kit';
import { parsePad } from '$lib/bron/leesbaar';

export const reroute: Reroute = ({ url }) => (parsePad(url.pathname) ? '/explore' : undefined);
