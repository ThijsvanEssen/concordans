// Copying to the clipboard, the same everywhere: the button that copied says
// Gekopieerd, or Kopiëren mislukt where the clipboard refuses, for two seconds, and a
// live region says the same to a screen reader.

export const COPY_MS = 2000;

type Write = (text: string) => Promise<void>;

const clipboard: Write = (text) => navigator.clipboard.writeText(text);

export function createCopier(write: Write = clipboard) {
	let last = $state<{ key: string; ok: boolean } | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		/** Copies `text`; `key` names the button, so only that one changes its label. */
		async copy(text: string, key = '') {
			let ok = true;
			try {
				await write(text);
			} catch {
				// The clipboard is refused in some contexts (an insecure page, a frame).
				ok = false;
			}
			last = { key, ok };
			clearTimeout(timer);
			timer = setTimeout(() => (last = null), COPY_MS);
			return ok;
		},
		/** The label of the button `key`: its own word, or what its last copy did. */
		label(key: string, idle: string) {
			return last?.key === key ? (last.ok ? 'Gekopieerd' : 'Kopiëren mislukt') : idle;
		},
		/** For an aria-live region. */
		get announcement() {
			return last ? (last.ok ? 'Gekopieerd' : 'Kopiëren mislukt') : '';
		}
	};
}
