// The last netwerk of chosen bronnen, kept in this browser until it is cleared: the werkplek
// opens on it again, and the button Netwerk of the top bar counts its bronnen ("Netwerk 2")
// wherever the reader is, so the way back to it is always in view (besluit 39).
import { untrack } from 'svelte';
import { readStored, writeStored } from '$lib/util/storage';
import { parseNetwerk } from './netwerk';

const KEY = 'concordans:netwerk';

const kept = $state<{ query: string | null }>({
	query: typeof window === 'undefined' ? null : readStored(KEY)
});

/** Read the kept netwerk again from storage: another tab, or a test, may have changed it. */
export function leesBewaard(): void {
	kept.query = readStored(KEY);
}

/** The kept netwerk as its query (`netwerk=…&uit=…`), or null. */
export const bewaardNetwerk = (): string | null => kept.query;

/**
 * Keep the netwerk of `query`; null forgets it. Untracked: an effect that keeps the netwerk of
 * its address must not run again when it is forgotten, or it keeps it once more (R3-N B2: the
 * last bron on /explore came back after ×).
 */
export function bewaarNetwerk(query: string | null): void {
	const value = query && parseNetwerk(new URLSearchParams(query)).ids.length > 0 ? query : null;
	if (value === untrack(() => kept.query)) return;
	kept.query = value;
	writeStored(KEY, value);
}

/** How many bronnen the kept netwerk holds. */
export const bewaardAantal = (): number =>
	kept.query ? parseNetwerk(new URLSearchParams(kept.query)).ids.length : 0;
