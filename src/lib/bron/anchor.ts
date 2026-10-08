// Landing on a position inside a text: the part named by the URL fragment is scrolled
// into view and marked. The mark goes at the next click.

const MARK = 'is-landed';

/** The fragment of a URL as an element id, or null. */
export const anchorOfHash = (hash: string): string | null => {
	const id = decodeURIComponent(hash.replace(/^#/, ''));
	return id ? id : null;
};

/** Scrolls to the element with `id` inside `root` and marks it. False when there is none. */
export function landOn(root: ParentNode, id: string): boolean {
	const target = root.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
	for (const old of root.querySelectorAll(`.${MARK}`)) old.classList.remove(MARK);
	if (!target) {
		// An anchor the bron does not have (an old `p-12` after the ids changed, 0.74):
		// the top of the bron, not the place the previous anchor left the reader at.
		if (root instanceof HTMLElement) scrollerOf(root)?.scrollTo({ top: 0 });
		return false;
	}
	target.classList.add(MARK);
	scrollInReader(target, 'center');
	// The click that brought the reader here has passed by the time this runs.
	setTimeout(() => {
		window.addEventListener('click', () => target.classList.remove(MARK), { once: true });
	});
	return true;
}

/**
 * Scrolls `target` into view in its reader only. `scrollIntoView` also moves the frames
 * around it that hide their overflow (the app's shell), which pushed its head out of sight.
 */
export function scrollInReader(target: HTMLElement, block: 'start' | 'center' = 'start') {
	const scroller = scrollerOf(target);
	if (!scroller) return target.scrollIntoView({ block });
	const box = scroller.getBoundingClientRect();
	const at = target.getBoundingClientRect();
	const offset = block === 'center' ? (box.height - at.height) / 2 : 16;
	scroller.scrollTo({ top: scroller.scrollTop + at.top - box.top - Math.max(offset, 0) });
}

/** The element a reader scrolls in: the nearest ancestor that scrolls. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const y = getComputedStyle(p).overflowY;
		if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
	}
	return null;
}

/** The address of a position in the current view, for the clipboard. */
export function permalink(url: URL, id: string): string {
	const link = new URL(url);
	link.hash = id;
	return link.toString();
}
