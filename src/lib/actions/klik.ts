// The one rule for a click on a row, a title or a reference, everywhere in Concordans: a
// plain click opens it in place (an opened row, a card), and from there a button leads on
// to the bron itself. Cmd-click, ctrl-click, shift-click and a middle click are the
// link's own: they open the bron at once, in a new tab where the browser does that.

/** A click without a modifier, of the main button: one that opens in place. */
export const gewoneKlik = (e: MouseEvent): boolean =>
	e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * For the onclick of a link that stands for a bron in a row or a list: a plain click
 * opens in place and goes nowhere; any other click is left to the link.
 */
export function terPlekke(e: MouseEvent, open: () => void): void {
	if (!gewoneKlik(e)) return;
	e.preventDefault();
	e.stopPropagation();
	open();
}

/** What in a clickable block is a control of its own, which a click on it is for. */
const CONTROLS = 'a, button, input, select, textarea, summary, [role="button"]';

/** Whether a click inside a clickable block landed on a control in it. */
function onControl(e: Event): boolean {
	const block = e.currentTarget as Element | null;
	const control = e.target instanceof Element ? e.target.closest(CONTROLS) : null;
	return !!control && control !== block && !!block?.contains(control);
}

/** The clicks a block took: a block around it leaves them. */
const taken = new WeakSet<Event>();

/**
 * For the onclick of a clickable row: a click on the row itself opens it. A click on a control
 * in it is that control's, a click that ends a text selection selects, and a click an inner
 * block took is that block's.
 */
export function rowClick(e: MouseEvent, open: () => void): void {
	if (taken.has(e) || onControl(e) || window.getSelection()?.toString()) return;
	taken.add(e);
	open();
}

/**
 * `use:blockClick={open}`: a click on the block opens it, as rowClick says; null makes it no
 * block. The block's button stays the keyboard's way in; this only widens its target, so the
 * block itself needs no key handler.
 */
export function blockClick(node: HTMLElement, open: ((e: MouseEvent) => void) | null) {
	let current = open;
	const listener = (e: MouseEvent) => {
		if (current) rowClick(e, () => current?.(e));
	};
	node.addEventListener('click', listener);
	return {
		update(next: ((e: MouseEvent) => void) | null) {
			current = next;
		},
		destroy() {
			node.removeEventListener('click', listener);
		}
	};
}
