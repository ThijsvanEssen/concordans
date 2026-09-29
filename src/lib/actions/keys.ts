// Escape closes the one thing on top, the same everywhere: not while typing in a field,
// not with a modifier, and not when something nearer (a menu) has already taken it.

type KeyLike = Pick<
	KeyboardEvent,
	'key' | 'defaultPrevented' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
> & {
	target: EventTarget | null;
};

const TYPING = 'input, select, textarea, [contenteditable]';

export function isEscape(e: KeyLike): boolean {
	if (e.key !== 'Escape' || e.defaultPrevented) return false;
	if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
	const el = e.target as { closest?: (selector: string) => unknown } | null;
	return !el?.closest?.(TYPING);
}
