// Copying to the clipboard, the same everywhere: the button that copied says Gekopieerd for
// two seconds, and the ritual's status line says what was copied, seen and heard
// (bevestig.svelte.ts). Where the clipboard refuses, that is a failure, not a Bevestiging
// (DS Bevestiging, Niet: een fout): only the button says so, in the words of a failure
// (LoadState: "kon niet"), and the status line stays as it was.

import { BEVESTIG_MS, announce } from '$lib/bevestig/bevestig.svelte';

export const COPY_MS = BEVESTIG_MS;
const FAILED = 'Kopiëren kon niet';

type Write = (text: string, html?: string) => Promise<void>;

/** The text, and beside it the same as HTML where one is given: a word processor keeps its form. */
const clipboard: Write = (text, html) =>
	html && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write
		? navigator.clipboard.write([
				new ClipboardItem({
					'text/plain': new Blob([text], { type: 'text/plain' }),
					'text/html': new Blob([html], { type: 'text/html' })
				})
			])
		: navigator.clipboard.writeText(text);

export function createCopier(write: Write = clipboard) {
	let last = $state<{ key: string; ok: boolean } | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		/** Copies `text`; `key` names the button, so only that one changes its label, and `wat`
		 *  names what was copied for the status line (`Gekopieerd: art. 6:162 BW`); `html` goes
		 *  with it, for a word processor. */
		async copy(text: string, key = '', wat?: string, html?: string) {
			let ok = true;
			try {
				await write(text, html);
			} catch {
				// The clipboard is refused in some contexts (an insecure page, a frame).
				ok = false;
			}
			last = { key, ok };
			if (ok) announce(wat ? `Gekopieerd: ${wat}` : 'Gekopieerd');
			clearTimeout(timer);
			timer = setTimeout(() => (last = null), COPY_MS);
			return ok;
		},
		/** The label of the button `key`: its own word, or what its last copy did. */
		label(key: string, idle: string) {
			return last?.key === key ? (last.ok ? 'Gekopieerd' : FAILED) : idle;
		}
	};
}
