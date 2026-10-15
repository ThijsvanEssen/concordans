// A party's colour as one CSS value, for a dot or a swatch: the colour of its fractie as
// $lib/components/explore/partijkleuren gives it (the Tweede Kamer's, else the Eerste
// Kamer's, else the party's own), by its abbreviation. A party none of them lists, such as
// KVP or ARP, is grey: a colour made up from the name meant nothing.
import { fractieKleuren } from './partijkleuren.svelte';

/** The colour of a party the API does not list. */
export const NO_PARTY_COLOR = 'var(--ink-3)';

/** A party's colour; grey until the API has answered, then its own. */
export const partyColor = (abbr: string): string => fractieKleuren(abbr)?.[0] ?? NO_PARTY_COLOR;
