// A party's colour as the API gives it (`/api/parties/colors`, the colours parties use
// themselves). A party it does not list, such as KVP or ARP, is grey: a colour made up
// from the name looked alike for VVD, D66 and CU and meant nothing.
import { api } from '$lib/api/client';

/** The colour of a party the API does not list. */
export const NO_PARTY_COLOR = 'var(--ink-3)';

// The API keys some parties by their full name; lists and votes use the abbreviation.
const ALIASES: Record<string, string> = {
	cu: 'ChristenUnie',
	gl: 'GroenLinks',
	'groenlinks-pvda': 'GroenLinks-PvdA'
};

/** The colour of `abbr` in `colors`, matched without regard to case. */
export function colorFor(abbr: string, colors: Record<string, string>): string {
	const key = abbr.trim();
	if (!key) return NO_PARTY_COLOR;
	const wanted = (ALIASES[key.toLowerCase()] ?? key).toLowerCase();
	const hit = Object.keys(colors).find((k) => k.toLowerCase() === wanted);
	return hit ? colors[hit] : NO_PARTY_COLOR;
}

const colors = $state<Record<string, string>>({});
let requested = false;

/** A party's colour; grey until the API has answered, then its own. */
export function partyColor(abbr: string): string {
	if (!requested && typeof window !== 'undefined') {
		requested = true;
		api
			.GET('/api/parties/colors')
			.then(({ data }) => Object.assign(colors, data?.colors ?? {}))
			.catch(() => {
				// Grey stays: the colour is an aid, the abbreviation names the party.
			});
	}
	return colorFor(abbr, colors);
}
