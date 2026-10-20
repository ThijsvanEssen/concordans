// How a menu behaves, on the element that holds its list (role="menu") and, unless it is given
// as `trigger` (a place's marker), its button (aria-haspopup). On open the focus goes to the
// chosen option, else the first item. The arrow keys, Home and End move between the items.
// Escape closes the menu and puts the focus back on the button; Tab closes it and moves on
// from the button. A click outside closes it (clickOutside, while open); one on the button is
// the button's.
import { afterTick } from '$lib/util/after-tick';
import type { Action } from 'svelte/action';
import { clickOutside } from './top-layer';

type Menu = { open: boolean; close: () => void; trigger?: HTMLElement };

const ITEMS = '[role^="menuitem"], a[href], button, input';
const CHOSEN = '[role="menuitemradio"][aria-checked="true"]';

/** The item a key moves to from item `i` (-1: none has the focus) of `n`, or null for another key. */
export function nextIndex(key: string, i: number, n: number): number | null {
	const last = n - 1;
	if (n === 0) return null;
	if (key === 'ArrowDown') return i < 0 || i === last ? 0 : i + 1;
	if (key === 'ArrowUp') return i <= 0 ? last : i - 1;
	if (key === 'Home') return 0;
	if (key === 'End') return last;
	return null;
}

/**
 * After a menu changed what it holds (a list of bundels in place of its items): the focus on
 * its first item, so its keys (Escape, the arrows) go on working.
 */
export const focusFirstItem = () =>
	afterTick(() =>
		document.querySelector<HTMLElement>(`[role="menu"] :is(${ITEMS}):not(:disabled)`)?.focus()
	);

export const menu: Action<HTMLElement, Menu> = (node, params) => {
	let { open, close, trigger: given } = params;

	/** What had the focus when the menu opened from outside it (Bewaard beside Bewaar's caret):
	 *  the focus goes back there (UX-toets A21 #6). */
	let opener: HTMLElement | null = null;
	const own = () => given ?? node.querySelector<HTMLElement>('[aria-haspopup]');
	const trigger = () => (opener?.isConnected ? opener : own());
	const noteOpener = () => {
		const at = document.activeElement as HTMLElement | null;
		opener = at && at !== document.body && !node.contains(at) ? at : null;
	};
	const items = () =>
		[...node.querySelectorAll<HTMLElement>(`[role="menu"] :is(${ITEMS})`)].filter(
			(el) => !(el as HTMLButtonElement).disabled
		);

	function focusFirst() {
		if (!open) return;
		const list = items();
		(list.find((el) => el.matches(CHOSEN)) ?? list[0])?.focus();
	}

	const onKey = (e: KeyboardEvent) => {
		if (!open) return;
		if (e.key === 'Escape') {
			// Stopped here, so that Escape does not also clear the selection of the network.
			e.preventDefault();
			e.stopPropagation();
			const back = trigger();
			close();
			back?.focus();
			return;
		}
		if (e.key === 'Tab') {
			// The browser then moves on from the button, as if the menu had not been there.
			trigger()?.focus();
			close();
			return;
		}
		const list = items();
		const next = nextIndex(e.key, list.indexOf(document.activeElement as HTMLElement), list.length);
		if (next === null) return;
		e.preventDefault();
		e.stopPropagation();
		list[next].focus();
	};

	node.addEventListener('keydown', onKey);
	let stop: (() => void) | null = null;
	const watch = () => {
		stop?.();
		stop = open
			? clickOutside(
					() => [node, given],
					() => close()
				)
			: null;
	};
	watch();
	if (open) {
		noteOpener();
		afterTick(focusFirst);
	}

	return {
		update(next) {
			const was = open;
			({ open, close, trigger: given } = next);
			if (open !== was) watch();
			if (open && !was) {
				noteOpener();
				afterTick(focusFirst);
			}
			if (!open && was) {
				// An item that closed the menu took the focus with it: it returns to the button.
				// A click elsewhere keeps the focus where it went. A menu whose button scrolled out of
				// view closed: the column stays where the reader scrolled it.
				const at = document.activeElement;
				if (!at || at === document.body || node.contains(at))
					trigger()?.focus({ preventScroll: true });
			}
		},
		destroy() {
			node.removeEventListener('keydown', onKey);
			stop?.();
		}
	};
};
