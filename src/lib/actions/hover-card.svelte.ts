// When the card of a link shows and goes, for a pointer, a finger and the keys: after the
// pointer or the focus rests a moment (HOVER_MS), never for a finger. A glance (the preview of
// a bron) goes when the pointer leaves, and a tap follows the link at once. A card to read (an
// r.o.) stays while the pointer crosses to it (LEAVE_MS), and on touch the first tap shows it,
// the second follows the link.
import { HOVER_MS, LEAVE_MS, clickOutside } from './top-layer';
import { isEscape } from './keys';

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

/**
 * What closes an open card, the same for every card a link shows (BronLink, FootnoteLink):
 * Escape wherever the focus is (after a tap it is on neither link nor card), before what holds
 * the link reacts (capture phase), a focus in the card put back on the link; a scroll of the
 * page or a resize, which move the link away (a scroll within the card does not); and for a
 * card to read a tap or click outside, before what was hit reacts. Returns what stops it.
 */
export function cardCloser({
	anchor,
	card,
	close,
	readable
}: {
	anchor: () => HTMLElement | null;
	card: () => HTMLElement | null;
	close: () => void;
	readable: boolean;
}): () => void {
	const inside = (t: EventTarget | null) =>
		t instanceof Node && (!!anchor()?.contains(t) || !!card()?.contains(t));
	const esc = (e: KeyboardEvent) => {
		// Only a card that shows: a glance that could not be loaded leaves Escape to the page.
		if (!isEscape(e) || !card()) return;
		close();
		e.preventDefault();
		e.stopPropagation();
		if (inside(document.activeElement)) anchor()?.focus();
	};
	const away = (e: Event) => {
		if (!inside(e.target)) close();
	};
	const stop = readable ? clickOutside(() => [anchor(), card()], close) : null;
	document.addEventListener('keydown', esc, true);
	addEventListener('scroll', away, { capture: true, passive: true });
	addEventListener('resize', close);
	return () => {
		stop?.();
		document.removeEventListener('keydown', esc, true);
		removeEventListener('scroll', away, { capture: true });
		removeEventListener('resize', close);
	};
}
