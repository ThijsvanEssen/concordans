// Opening and closing the Leespaneel (param.ts), and where a reference opens it. A click opens
// one step in the history, so Back closes the panel; from article to article within the panel
// that step is replaced. Closing with × or Escape is that step back when this page opened it,
// and otherwise (a shared link) only takes the parameter away: Back never walks ten peeks back.
import { getContext, setContext } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { report } from '$lib/api/errors';
import { READ_PARAM, withRead, type ReadRef } from './param';

const NAV = { noScroll: true, keepFocus: true } as const;

/** The panel's element: a reference names it in aria-controls. */
export const PANEL_ID = 'leespaneel';

/** Opens the panel on this article, or puts it in the place of the one it shows. */
export function openInPanel(item: ReadRef): void {
	const open = page.url.searchParams.has(READ_PARAM);
	goto(withRead(page.url, [item]), {
		...NAV,
		replaceState: open,
		state: open ? page.state : { ...page.state, readOpened: true }
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

const KEY = Symbol('reading-panel');

/** A reference to an article below this component opens the panel: a text read, not a list. */
export const readHere = () => setContext(KEY, true);

/** Whether a reference to an article here opens the panel (readHere). */
export const opensPanel = (): boolean => getContext<boolean | undefined>(KEY) ?? false;
