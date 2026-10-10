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
