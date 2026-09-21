import { getContext, setContext } from 'svelte';

// Single source of truth for opening the global search overlay from anywhere
// in the component tree. AppShell owns the state and provides the opener via
// Svelte context; consumers import `useSearchOpener()` and call it on click.
const KEY = Symbol('search-opener');

export function provideSearchOpener(open: () => void): void {
	setContext(KEY, open);
}

export function useSearchOpener(): () => void {
	return getContext<() => void>(KEY) ?? (() => {});
}
