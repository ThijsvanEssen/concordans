// Platform-detectie voor sneltoets-hints.
//
// SSR retourneert default Mac (⌘) zodat de pre-rendered HTML constant
// is per-pagina-build; bij hydratie op een niet-Mac client wisselt het
// label naar Ctrl. Dat geeft op niet-Mac systemen één frame met het
// verkeerde symbool — acceptabel voor een keyboard hint, geen
// hydration-mismatch-warning omdat de wisseling pas in een $effect
// gebeurt nadat Svelte de DOM heeft overgenomen.
//
// Gebruik:
//   import { modKey } from '$lib/utils/platform';
//   <kbd>{modKey} K</kbd>
//
// Voor SVG-text of plekken waar reactiviteit ertoe doet: gebruik de
// `modKey`-export rechtstreeks; Svelte 5 leest module-level state als
// een waarde — bij module-load op de client is `modKey` al correct.

import { browser } from '$app/environment';

function detectIsMac(): boolean {
	if (!browser) return true; // SSR-default: tonen Mac-symbool

	// Voorkeur: User-Agent Client Hints API (moderne browsers, accurater
	// dan UA-string sniffing). Voor Firefox/Safari die hem niet
	// ondersteunen valt het terug op userAgent.
	const navAny = navigator as Navigator & {
		userAgentData?: { platform?: string };
	};
	const hint = navAny.userAgentData?.platform;
	if (typeof hint === 'string' && hint.length > 0) {
		return /mac/i.test(hint);
	}
	// navigator.platform is deprecated maar nog wel breed ondersteund;
	// userAgent als laatste vangnet voor oude Safari/iOS.
	const ua = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
	return /Mac|iPhone|iPad|iPod/.test(ua);
}

/** True op macOS / iOS / iPadOS, anders false. */
const isMac: boolean = detectIsMac();

/** Toets-label voor de "command"-toets — `⌘` op Mac, `Ctrl` op andere. */
export const modKey: '⌘' | 'Ctrl' = isMac ? '⌘' : 'Ctrl';
