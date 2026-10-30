// Recent in ⌘K: the last places the reader left, by the name the tab gave them, so a place of a
// moment ago is two keys away. Kept in this tab (sessionStorage); a page without storage keeps
// them while it stands.
import { goto } from '$app/navigation';
import type { DoRow } from './doen.svelte';
import { ignore } from '$lib/api/errors';

const KEY = 'concordans.recent';
const MAX = 5;
const SUFFIX = ', Concordans';

type Place = { href: string; title: string };

function read(): Place[] {
	try {
		const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
		return Array.isArray(list) ? list : [];
	} catch (e) {
		ignore('Recent')(e);
		return [];
	}
}

let places = $state.raw<Place[]>(typeof sessionStorage === 'undefined' ? [] : read());

/** The place being left, before the next is drawn: its title is still its own. */
export function leave(url: URL, title: string) {
	if (!title.endsWith(SUFFIX)) return;
	const place = { href: `${url.pathname}${url.search}`, title: title.slice(0, -SUFFIX.length) };
	// One row per page: a weergave or a filter of it is the same place, as it was last.
	places = [place, ...places.filter((p) => new URL(p.href, url).pathname !== url.pathname)].slice(
		0,
		MAX
	);
	try {
		sessionStorage.setItem(KEY, JSON.stringify(places));
	} catch (e) {
		// No storage: Recent lives as long as the page.
		ignore('Recent')(e);
	}
}

/** The rows Recent, the place the reader is on left out. */
export function recentRows(here: URL): DoRow[] {
	return places
		.filter((p) => new URL(p.href, here).pathname !== here.pathname)
		.map((p, i) => ({
			id: `recent-${i}`,
			label: p.title,
			group: 'Recent',
			run: () => goto(p.href)
		}));
}
