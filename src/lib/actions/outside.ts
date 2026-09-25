// How a menu, a popup or a sheet closes: on a click outside it. The click is only
// watched, never stopped. A menu that stopped clicks from bubbling kept SvelteKit from
// seeing the links inside it, and the browser then loaded the whole page again.
import type { Action } from 'svelte/action';

export const outside: Action<HTMLElement, () => void> = (node, close) => {
	let onOutside = close;
	const onClick = (e: MouseEvent) => {
		if (e.target instanceof Node && !node.contains(e.target)) onOutside();
	};
	// The capture phase: the menu closes before whatever was clicked reacts.
	document.addEventListener('click', onClick, true);
	return {
		update(next) {
			onOutside = next;
		},
		destroy() {
			document.removeEventListener('click', onClick, true);
		}
	};
};

/** Whether a click inside a clickable row landed on a control of its own (a link, a button). */
export const onControl = (e: Event) =>
	e.target instanceof Element && e.target !== e.currentTarget && !!e.target.closest('a, button');
