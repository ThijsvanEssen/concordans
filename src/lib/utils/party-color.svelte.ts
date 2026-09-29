// A party's colour as the API gives it (`/api/parties/colors`, the colours parties use
// themselves). A party it does not list, such as KVP or ARP, is grey: a colour made up
// from the name looked alike for VVD, D66 and CU and meant nothing.
import { api } from '$lib/api/client';

/** The colour of a party the API does not list. */
export const NO_PARTY_COLOR = 'var(--ink-3)';

/**
 * The colour of `abbr` in `colors`, matched without regard to case. The API keys some
 * parties by their full name; `aliases` (from the API too) leads an abbreviation to it:
 * `CU` to `ChristenUnie`, `PRO` to `GroenLinks-PvdA`.
 */
export function colorFor(
	abbr: string,
	colors: Record<string, string>,
	aliases: Record<string, string> = {}
): string {
	const key = abbr.trim();
	if (!key) return NO_PARTY_COLOR;
	const lookup = (map: Record<string, string>, name: string) => {
		const hit = Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase());
		return hit ? map[hit] : undefined;
	};
	const wanted = lookup(aliases, key) ?? key;
	return lookup(colors, wanted) ?? NO_PARTY_COLOR;
}

const colors = $state<Record<string, string>>({});
const aliases = $state<Record<string, string>>({});
let requested = false;

/** A party's colour; grey until the API has answered, then its own. */
export function partyColor(abbr: string): string {
	if (!requested && typeof window !== 'undefined') {
		requested = true;
		api
			.GET('/api/parties/colors')
			.then(({ data }) => {
				Object.assign(aliases, data?.aliases ?? {});
				Object.assign(colors, data?.colors ?? {});
			})
			.catch(() => {
				// Grey stays: the colour is an aid, the abbreviation names the party.
			});
	}
	return colorFor(abbr, colors, aliases);
}
