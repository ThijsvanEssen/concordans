// What the last action on the network did, with a way back: "3 artikelen getekend in het
// netwerk. Ongedaan maken". On a phone the network shows it, since the action took the reader
// to the Netwerk tab and the place it was done from is out of sight (Thijs, 9 Oct).
import { writable } from 'svelte/store';

export type NetwerkMelding = { tekst: string; terug: (() => void) | null };

export const netwerkMelding = writable<NetwerkMelding | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;
/** Say it for a while; a newer message takes its place. */
export function meldNetwerk(tekst: string, terug: (() => void) | null, ms = 8000) {
	clearTimeout(timer);
	netwerkMelding.set({ tekst, terug });
	timer = setTimeout(() => netwerkMelding.set(null), ms);
}
