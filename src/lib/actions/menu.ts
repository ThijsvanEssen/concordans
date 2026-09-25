// How a menu behaves, on the element that holds its button (aria-haspopup) and its list
// (role="menu"). On open the focus goes to the checked item, else the first. The arrow
// keys, Home and End move between the items. Escape closes the menu and puts the focus
// back on the button; Tab closes it and moves on from the button. A click outside closes
// it, as `outside` does: the click is only watched, never stopped.
import { tick } from 'svelte';
import type { Action } from 'svelte/action';

type Menu = { open: boolean; close: () => void };

const ITEMS = '[role^="menuitem"], a[href], button, input';

export const menu: Action<HTMLElement, Menu> = (node, params) => {
	let { open, close } = params;

	const trigger = () => node.querySelector<HTMLElement>('[aria-haspopup]');
	const items = () =>
		[...node.querySelectorAll<HTMLElement>(`[role="menu"] :is(${ITEMS})`)].filter(
			(el) => !(el as HTMLButtonElement).disabled
		);

	function focusFirst() {
		if (!open) return;
		const list = items();
		(list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0])?.focus();
	}

	const onKey = (e: KeyboardEvent) => {
		if (!open) return;
		if (e.key === 'Escape') {
			// Stopped here, so that Escape does not also clear the selection of the network.
			e.preventDefault();
			e.stopPropagation();
			close();
			trigger()?.focus();
			return;
		}
		if (e.key === 'Tab') {
			// The browser then moves on from the button, as if the menu had not been there.
			trigger()?.focus();
			close();
			return;
		}
		const list = items();
		if (list.length === 0) return;
		const i = list.indexOf(document.activeElement as HTMLElement);
		const last = list.length - 1;
		const next =
			e.key === 'ArrowDown'
				? i < 0 || i === last
					? 0
					: i + 1
				: e.key === 'ArrowUp'
					? i <= 0
						? last
						: i - 1
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? last
							: null;
		if (next === null) return;
		e.preventDefault();
		e.stopPropagation();
		list[next].focus();
	};

	const onClick = (e: MouseEvent) => {
		if (open && e.target instanceof Node && !node.contains(e.target)) close();
	};

	node.addEventListener('keydown', onKey);
	// The capture phase: the menu closes before whatever was clicked reacts.
	document.addEventListener('click', onClick, true);
	if (open) void tick().then(focusFirst);

	return {
		update(next) {
			const was = open;
			({ open, close } = next);
			if (open && !was) void tick().then(focusFirst);
			if (!open && was) {
				// An item that closed the menu took the focus with it: it returns to the button.
				// A click elsewhere keeps the focus where it went.
				const at = document.activeElement;
				if (!at || at === document.body || node.contains(at)) trigger()?.focus();
			}
		},
		destroy() {
			node.removeEventListener('keydown', onKey);
			document.removeEventListener('click', onClick, true);
		}
	};
};
