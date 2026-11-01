// Landing on a position inside a text: the part named by the URL fragment is scrolled
// into view and marked. The mark goes at the next click.
import { withoutBundle } from '$lib/map/page';

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

/**
 * Keeps what the reader looks at in place while text goes in above it: the first of
 * `selector` in `root` still in view is measured now; the function returned, called once the
 * new text stands, scrolls by as far as it moved.
 */
export function keepInPlace(root: HTMLElement, selector: string): () => void {
	const top = scrollerOf(root)?.getBoundingClientRect().top ?? 0;
	const anchor = [...root.querySelectorAll<HTMLElement>(selector)].find(
		(el) => el.getBoundingClientRect().bottom > top
	);
	if (!anchor) return () => {};
	const before = anchor.getBoundingClientRect().top;
	return () => {
		if (!anchor.isConnected) return;
		const moved = anchor.getBoundingClientRect().top - before;
		if (!moved) return;
		// The reader may only scroll now that the text above made it longer.
		const scroller = scrollerOf(anchor);
		if (scroller) scroller.scrollTop += moved;
		else window.scrollBy(0, moved);
	};
}

/** The element a reader scrolls in: the nearest ancestor that scrolls. */
export function scrollerOf(el: HTMLElement): HTMLElement | null {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const y = getComputedStyle(p).overflowY;
		if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
	}
	return null;
}

/** What the reader's text scrolls in stands around this element. */
const readerInner = () => {
	const column = document.querySelector<HTMLElement>('.col--reader');
	const frame = column?.querySelector<HTMLElement>('.reader-frame__col');
	return frame ?? column?.querySelector<HTMLElement>('.reader') ?? column;
};

/** How far the reader's text is scrolled. */
export function readerTop(): number {
	const el = readerInner();
	return (el && scrollerOf(el)?.scrollTop) ?? 0;
}

/**
 * The text just drawn, once it is there: its heading holds the focus, and `top` is where its
 * scroller stands (null: where it came), as soon as the text reaches that far. `replaced` is the
 * heading of the text it replaces.
 */
export function landOnHeading(top: number | null, replaced = '') {
	let tries = 0;
	const place = () => {
		const el = readerInner();
		const heading = document.querySelector<HTMLElement>('.col--reader h1');
		if (!el || !heading || heading.textContent === replaced) {
			if (tries++ < 60) requestAnimationFrame(place);
			return;
		}
		const scroller = scrollerOf(el);
		if (scroller && top !== null) scroller.scrollTop = top;
		if (top && (scroller?.scrollTop ?? 0) < top - 1 && tries++ < 180) {
			requestAnimationFrame(place);
			return;
		}
		heading.tabIndex = -1;
		heading.focus({ preventScroll: true });
	};
	place();
}

/** The address of a position in the current view, for the clipboard. */
export function permalink(url: URL, id: string): string {
	// The bundel a reader keeps in is this browser's, never part of a link (UX-toets A21 #2).
	const link = withoutBundle(url);
	link.hash = id;
	return link.toString();
}

/** The address of the current view without a position: the same while only the hash changes. */
export const viewLink = (url: URL): string => permalink(url, '');

/** The address of a position in a view given by viewLink. */
export const linkTo = (view: string, id: string): string => permalink(new URL(view), id);
