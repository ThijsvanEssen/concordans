// Whether "Zoek in dit stuk" is open, and the column it searches. A class because ReaderFrame
// has a prop called `state`, which keeps it from using the $state rune.
export class SearchState {
	open = $state(false);
	column = $state<HTMLElement | null>(null);

	toggle() {
		this.open = !this.open;
	}

	close() {
		this.open = false;
	}
}

/** The frame's "Zoek in dit stuk", for the head of its reader: the button stands in the head's
 *  row of actions (ReaderHead), with Bewaar and Citeer, the field under it. */
export const FIND_KEY = Symbol('find-in-text');

/** What the frame gives its head: whether its text is long, and the state of the search. */
export type FindInText = { readonly find: boolean; search: SearchState };
