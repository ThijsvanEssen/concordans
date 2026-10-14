// When the card of a link shows and goes, for a pointer, a finger and the keys: after the
// pointer or the focus rests a moment (HOVER_MS), never for a finger. A glance (the preview of
// a bron) goes when the pointer leaves, and a tap follows the link at once. A card to read (an
// r.o.) stays while the pointer crosses to it (LEAVE_MS), and on touch the first tap shows it,
// the second follows the link.
import { HOVER_MS, LEAVE_MS } from './top-layer';

export class HoverCard {
	open = $state(false);
	/** The last pointer was a finger: its focus and its emulated hover show no card. */
	#touch = false;
	#timer: ReturnType<typeof setTimeout> | null = null;
	readonly #readable: () => boolean;

	/** `readable`: a card to read, not a glance. */
	constructor(readable: () => boolean) {
		this.#readable = readable;
	}

	#clear() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
	}

	#after(ms: number, then: () => void) {
		this.#clear();
		this.#timer = setTimeout(() => {
			this.#timer = null;
			then();
		}, ms);
	}

	/** The pointer that comes down or in: `touch`, `mouse` or `pen`. */
	pointer(type: string) {
		this.#touch = type === 'touch';
	}

	/** A key was pressed: the focus that follows is the keyboard's. */
	keys() {
		this.#touch = false;
	}

	/** The pointer or the focus comes to the link or its card: an open card stays. */
	enter() {
		if (this.#touch) return;
		if (this.open) return this.#clear();
		this.#after(HOVER_MS, () => {
			this.open = true;
		});
	}

	/** The pointer leaves the link or its card. */
	leave() {
		if (this.#touch) return;
		if (this.open && this.#readable())
			this.#after(LEAVE_MS, () => {
				this.open = false;
			});
		else this.close();
	}

	/** A tap or a click on the link: true where it only shows the card (it goes no further). */
	tap(): boolean {
		if (this.#touch && this.#readable() && !this.open) {
			this.#clear();
			this.open = true;
			return true;
		}
		this.close();
		return false;
	}

	close() {
		this.#clear();
		this.open = false;
	}
}
