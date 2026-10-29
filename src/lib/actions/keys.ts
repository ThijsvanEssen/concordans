// Escape closes the one thing on top, the same everywhere: not while typing in a field,
// not with a modifier, and not when something nearer (a menu) has already taken it.

type KeyLike = Pick<
	KeyboardEvent,
	'key' | 'defaultPrevented' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
> & {
	target: EventTarget | null;
};

/** Whether a key lands in a field: a keyboard shortcut leaves it to the field. */
export function isTyping(target: EventTarget | null): boolean {
	const el = target as { closest?: (selector: string) => unknown } | null;
	return !!el?.closest?.('input, select, textarea, [contenteditable]');
}

/** Whether a key is pressed with a modifier: a shortcut of its own, or the browser's. */
export const hasModifier = (e: Pick<KeyLike, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>) =>
	e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

export function isEscape(e: KeyLike): boolean {
	if (e.key !== 'Escape' || e.defaultPrevented) return false;
	return !hasModifier(e) && !isTyping(e.target);
}

/**
 * Whether a one-key shortcut (J, K or N in a list that holds the focus) may act now: not with a modifier, not when
 * something nearer took the key, not while the focus is in a field (input, select, textarea,
 * contenteditable), and not while a Blad, dialog or menu is open: the keys then belong to it.
 */
export function mayShortcut(e: KeyLike): boolean {
	if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return false;
	if (isTyping(e.target)) return false;
	if (typeof document === 'undefined') return true;
	if (isTyping(document.activeElement)) return false;
	return !modalOpen();
}

/** Whether a Blad, a dialog or a menu is open: the keys of the page then belong to it. */
export function modalOpen(): boolean {
	return (
		typeof document !== 'undefined' &&
		!!document.querySelector('[aria-modal="true"], [role="menu"]')
	);
}
