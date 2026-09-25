import { getContext, setContext } from 'svelte';

// Single source of truth for opening the global search overlay from anywhere
// in the component tree. AppShell owns the state and provides the opener via
// Svelte context; consumers import `useSearchOpener()` and call it on click.
const KEY = Symbol('search-opener');

/** Opens the search; with a query, the field starts with that text. */
export type SearchOpener = (query?: string) => void;

export function provideSearchOpener(open: SearchOpener): void {
	setContext(KEY, open);
}

export function useSearchOpener(): SearchOpener {
	return getContext<SearchOpener>(KEY) ?? (() => {});
}
