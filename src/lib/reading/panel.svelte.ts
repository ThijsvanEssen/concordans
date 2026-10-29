// Opening and closing the Leespaneel (param.ts), and where a reference opens it. A click opens
// one step in the history, so Back closes the panel; from article to article within the panel
// that step is replaced. Closing with × or Escape is that step back when this page opened it,
// and otherwise (a shared link) only takes the parameter away: Back never walks ten peeks back.
import { getContext, setContext } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { report } from '$lib/api/errors';
import { READ_PARAM, parseRead, withRead, type ReadRef } from './param';

const NAV = { noScroll: true, keepFocus: true } as const;

/** The panel's element: a reference names it in aria-controls. */
export const PANEL_ID = 'leespaneel';

/** Where the panel opens: at which of its articles, and whether from a row of Verbonden. */
type OpenAt = { focus?: string; from?: 'verbonden' };

/**
 * Opens the panel on these articles, or puts them in the place of what it shows. Several stand
 * under each other (the stapel); `focus` is the one it opens at, by default the first.
 */
export function openInPanel(items: ReadRef | readonly ReadRef[], at: OpenAt = {}): void {
	const list = Array.isArray(items) ? items : [items as ReadRef];
	const open = page.url.searchParams.has(READ_PARAM);
	// Where it opens is this opening's own: not carried over from the one before.
	const state: App.PageState = { ...page.state };
	delete state.readFocus;
	delete state.readFrom;
	goto(withRead(page.url, list), {
		...NAV,
		replaceState: open,
		state: {
			...state,
			...(open ? {} : { readOpened: true }),
			...(at.focus ? { readFocus: at.focus } : {}),
			...(at.from ? { readFrom: at.from } : {})
		}
	}).catch((e) => report('Leespaneel', e));
}

/** Closes the panel: a step back when this page opened it, else the parameter taken away. */
export function closePanel(): void {
	if (page.state.readOpened) history.back();
	else
		goto(withRead(page.url, []), { ...NAV, replaceState: true }).catch((e) =>
			report('Leespaneel', e)
		);
}

/** The articles the panel shows, from the address. */
export const readOpen = (): ReadRef[] => parseRead(page.url.searchParams.get(READ_PARAM));

/** Whether the panel shows this article, at this place: a reference to it is landed. */
export const isRead = (item: ReadRef): boolean =>
	readOpen().some((r) => r.key === item.key && r.at === item.at);

/** Another address of the page beside it, the panel kept open there (Alt L, Tekst and Netwerk). */
export function keepRead(href: string): string {
	const reads = readOpen();
	return reads.length ? withRead(new URL(href, page.url), reads) : href;
}

const KEY = Symbol('reading-panel');

/** A reference to an article below this component opens the panel: a text read, not a list. */
export const readHere = () => setContext(KEY, true);

/** Whether a reference to an article here opens the panel (readHere). */
export const opensPanel = (): boolean => getContext<boolean | undefined>(KEY) ?? false;
