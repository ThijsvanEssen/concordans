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
	if (!target) return false;
	for (const old of root.querySelectorAll(`.${MARK}`)) old.classList.remove(MARK);
	target.classList.add(MARK);
	target.scrollIntoView({ block: 'center', behavior: 'auto' });
	// The click that brought the reader here has passed by the time this runs.
	setTimeout(() => {
		window.addEventListener('click', () => target.classList.remove(MARK), { once: true });
	});
	return true;
}

/** The address of a position in the current view, for the clipboard. */
export function permalink(url: URL, id: string): string {
	const link = new URL(url);
	link.hash = id;
	return link.toString();
}
