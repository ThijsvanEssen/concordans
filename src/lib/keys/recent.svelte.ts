// Recent in ⌘K: the last bronnen the reader left, by the name the tab gave them, so a bron of a
// moment ago is two keys away; the right column shows it as it does a hit. A page that is no bron
// (the start page, Zoeken) is no place to go back to (UX-toets 5 Nov). Kept in this tab
// (sessionStorage); a page without storage keeps them while it stands.
import { goto } from '$app/navigation';
import type { DoRow } from './doen.svelte';
import { arrayOf, readJson, writeJson } from '$lib/util/storage';
import { focusIn } from '$lib/bron/address';

const KEY = 'concordans.recent';
const MAX = 5;
const SUFFIX = ', Concordans';

/** `focus`: the node id of the bron, `instruments/bwbr0005537`. */
type Place = { href: string; title: string; focus: string };

// A place kept before Recent held only bronnen has no focus.
const read = () =>
	readJson('session', KEY, (list) =>
		arrayOf(list).filter((p): p is Place => !!(p as Place)?.focus)
	) ?? [];

let places = $state.raw<Place[]>(read());

/** The place being left, before the next is drawn: its title is still its own. */
export function leave(url: URL, title: string) {
	const focus = focusIn(url);
	if (!focus || !title.endsWith(SUFFIX)) return;
	const place = {
		href: `${url.pathname}${url.search}`,
		title: title.slice(0, -SUFFIX.length),
		focus
	};
	// One row per page: a weergave or a filter of it is the same place, as it was last.
	places = [place, ...places.filter((p) => new URL(p.href, url).pathname !== url.pathname)].slice(
		0,
		MAX
	);
	// No storage: Recent lives as long as the page.
	writeJson('session', KEY, places);
}

/** The rows Recent, the place the reader is on left out. */
export function recentRows(here: URL): DoRow[] {
	return places
		.filter((p) => new URL(p.href, here).pathname !== here.pathname)
		.map((p, i) => ({
			id: `recent-${i}`,
			label: p.title,
			group: 'Recent',
			bron: p.focus,
			run: () => goto(p.href)
		}));
}
