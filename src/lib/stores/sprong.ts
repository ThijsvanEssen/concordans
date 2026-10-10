// A page's second skip link, "Naar de lijst", where it has a list to reach past its filters
// (Actueel, the lists of Bronnen; Thijs, 10 Oct, approved suggestion 7). AppShell shows it
// beside "Naar inhoud" while a list says where it stands.
import { writable } from 'svelte/store';

/** The id of the list a skip link leads to; null where the page has none. */
export const lijstSprong = writable<string | null>(null);

/** On the list's element: it gets an id and can take the focus the link gives it. */
export function lijstDoel(el: HTMLElement, id = 'de-lijst') {
	if (!el.id) el.id = id;
	el.tabIndex = -1;
	lijstSprong.set(el.id);
	return {
		destroy() {
			lijstSprong.set(null);
		}
	};
}

/**
 * The panes of a page a skip link leads to beside its text: Verbonden and the network on a
 * bron (UX-toets 10 Oct, #22: Verbonden was the 237th tab stop, the network the 278th). In
 * the page's order; a pane on its own tab (a phone) has its tab instead.
 */
export const paneelSprongen = writable<{ id: string; label: string }[]>([]);

/** On a pane: it gets its id, can take the focus, and has a skip link while `aan`. */
export function sprongDoel(el: HTMLElement, opts: { id: string; label: string; aan?: boolean }) {
	let huidig = opts;
	const zet = () => {
		el.id = huidig.id;
		el.tabIndex = -1;
		paneelSprongen.update((l) => {
			const zonder = l.filter((s) => s.id !== huidig.id);
			return huidig.aan === false ? zonder : [...zonder, { id: huidig.id, label: huidig.label }];
		});
	};
	const weg = () => paneelSprongen.update((l) => l.filter((s) => s.id !== huidig.id));
	zet();
	return {
		update(next: typeof opts) {
			weg();
			huidig = next;
			zet();
		},
		destroy: weg
	};
}
