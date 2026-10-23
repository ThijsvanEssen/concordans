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

/** The parts of a reader's text that are still on their way (the articles of a law, the
 *  procedure of a dossier): until none is, the frame is not done and Verbonden, which stands
 *  under the text on a narrow screen, waits (UX-toets T9: it stood there and was pushed). */
export const WAIT_KEY = Symbol('frame-wait');

/** What the frame gives a reader to say that a part of its text is still coming. */
export type FrameWait = (pending: () => boolean) => () => void;

/** The parts that are still coming, counted by the frame. */
export class FramePending {
	parts = $state<(() => boolean)[]>([]);
	get any() {
		return this.parts.some((p) => p());
	}
}
