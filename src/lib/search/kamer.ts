// A Kamer itself is no bron in the network: a search for it is answered with the places
// that show it, its leden, fracties and stemmingen in Bladeren (UX-5).
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { indexHref } from '$lib/bron/href';

const KAMER = /^(?:de\s+)?(eerste|tweede)\s+kamer(?:\s+der\s+staten-generaal)?$/i;

/** The Kamer a query names in full ("Eerste Kamer", "de Tweede Kamer"), or null. */
export function chamberOf(query: string): Chamber | null {
	const m = KAMER.exec(query.trim().replace(/\s+/g, ' '));
	if (!m) return null;
	return m[1].toLowerCase() === 'eerste' ? 'EK' : 'TK';
}

/** The places in Bladeren that show a Kamer: its leden, fracties and stemmingen. */
export const chamberLinks = (kamer: Chamber) => [
	{ label: 'leden', href: indexHref('members', { kamer }) },
	{ label: 'fracties', href: indexHref('factions', { kamer }) },
	{ label: 'stemmingen', href: indexHref('decisions', { kamer }) }
];
