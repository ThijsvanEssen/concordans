// A fake of `$app/state` and `$app/navigation` for a page in a test: the address is state the
// page reacts to, `goto` takes a history entry or replaces it, and Back and Forward come as a
// popstate. Mock both modules with it:
//   vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
//   vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);
import { onDestroy, onMount } from 'svelte';
import { onForget } from '$lib/util/forget';

const ORIGIN = 'http://localhost';

type NavigationType = 'enter' | 'goto' | 'popstate';
type Navigation = { type: NavigationType; from: { url: URL } | null; to: { url: URL } | null };

const page = $state({ url: new URL('/', ORIGIN) });
/** The navigation under way, as SvelteKit's `navigating`: Back is one until the page reacted. */
const navigating = $state<{ type: NavigationType | null }>({ type: null });
let entries: URL[] = [page.url];
let at = 0;
const listeners = new Set<(nav: Navigation) => void>();

/** The steps the page took, in order: its href and whether it took a history entry. */
export const steps: { href: string; step: boolean }[] = [];

onForget(() => {
	entries = [new URL('/', ORIGIN)];
	at = 0;
	page.url = entries[0];
	steps.length = 0;
	listeners.clear();
});

const notify = (type: NavigationType, from: URL, to: URL) =>
	listeners.forEach((listener) => listener({ type, from: { url: from }, to: { url: to } }));

/** The page opens at `href`: the first entry of its history. */
export function open(href: string) {
	entries = [new URL(href, ORIGIN)];
	at = 0;
	page.url = entries[0];
}

/** The address as the bar shows it: path, query and fragment. */
export const address = () => `${page.url.pathname}${page.url.search}${page.url.hash}`;

/** The history from the first entry to the last, and where the page stands in it. */
export const history = () => ({ entries: entries.map((u) => `${u.pathname}${u.search}`), at });

function goto(href: string, { replaceState = false } = {}) {
	const from = page.url;
	const url = new URL(href, from);
	steps.push({ href, step: !replaceState });
	if (replaceState) entries[at] = url;
	else {
		entries = [...entries.slice(0, at + 1), url];
		at++;
	}
	page.url = url;
	notify('goto', from, url);
	return Promise.resolve();
}

function go(delta: number) {
	const next = at + delta;
	if (next < 0 || next >= entries.length) return;
	const from = page.url;
	at = next;
	navigating.type = 'popstate';
	page.url = entries[at];
	notify('popstate', from, page.url);
	setTimeout(() => {
		navigating.type = null;
	});
}

/** Back, as the browser's button. */
export const back = () => go(-1);
/** Forward, as the browser's button. */
export const forward = () => go(1);

function afterNavigate(listener: (nav: Navigation) => void) {
	onMount(() => {
		listeners.add(listener);
		listener({ type: 'enter', from: null, to: { url: page.url } });
	});
	onDestroy(() => listeners.delete(listener));
}

export const appState = { page, navigating, updated: { current: false, check: async () => false } };

export const appNavigation = {
	goto,
	afterNavigate,
	beforeNavigate: () => {},
	replaceState: () => {}
};
