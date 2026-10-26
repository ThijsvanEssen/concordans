// What the last action on the network did, with a way back: "3 artikelen getekend in het
// netwerk. Ongedaan maken". On a phone the network shows it, since the action took the reader
// to the Netwerk tab and the place it was done from is out of sight (Thijs, 9 Oct). Wider than
// a phone the same words go through the Bevestiging of the site (role=status, Ongedaan maken),
// as Bewaard in does. A network that could not be drawn says so on every screen, with Opnieuw,
// until it is asked again.
import { writable } from 'svelte/store';
import { announce } from '$lib/bevestig/bevestig.svelte';
import type { LoadFailure } from '$lib/util/load.svelte';

type NetwerkMelding =
	| { tekst: string; terug: (() => void) | null; failure?: undefined }
	| { failure: LoadFailure; tekst?: undefined; terug?: undefined };

export const netwerkMelding = writable<NetwerkMelding | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;
const isPhone = () =>
	typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/** Say it for a while; a newer message takes its place. */
export function meldNetwerk(tekst: string, terug: (() => void) | null, ms = 8000) {
	clearTimeout(timer);
	if (!isPhone()) {
		// Bevestiging closes the sentence itself before Ongedaan maken.
		netwerkMelding.set(null);
		announce(terug ? tekst.replace(/\.$/, '') : tekst, undefined, terug ?? undefined);
		return;
	}
	netwerkMelding.set({ tekst, terug });
	timer = setTimeout(() => netwerkMelding.set(null), ms);
}

/** A failure on the network: it stays until a newer message or Opnieuw, which asks it again. */
export function showNetworkFailure(failure: LoadFailure) {
	clearTimeout(timer);
	netwerkMelding.set({
		failure: {
			...failure,
			retry: () => {
				netwerkMelding.set(null);
				failure.retry();
			}
		}
	});
}
