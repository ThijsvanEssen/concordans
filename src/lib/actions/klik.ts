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

/** Whether a click inside a clickable row landed on a control of its own (a link, a button). */
const onControl = (e: Event) =>
	e.target instanceof Element && e.target !== e.currentTarget && !!e.target.closest('a, button');

/**
 * For the onclick of a clickable row: a click on the row itself opens it. A click on a link
 * or button in it is that control's, and a click that ends a text selection selects.
 */
export function rowClick(e: MouseEvent, open: () => void): void {
	if (onControl(e) || window.getSelection()?.toString()) return;
	open();
}
