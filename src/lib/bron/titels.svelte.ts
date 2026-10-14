// The title of a bron as its page has it, from /api/nodes/{collection}/{key} (`title`, API
// 0.79.44, #529): the server's <title> without the site's name, one source for the server's
// head and the browser tab, never cut (Back-end #3, 10 Oct). The light node and the full one
// carry the same. Kept per node id as answers come in.
import { SvelteMap } from 'svelte/reactivity';
import { onForget } from '$lib/util/forget';

const titels = new SvelteMap<string, string>();
onForget(() => titels.clear());

/**
 * A title without a heading of its text in capitals after it: `Stb. 2026, 187`, not
 * `Stb. 2026, 187: BEGRIPSBEPALING` (the first heading of its nota van toelichting).
 * TODO(back end): the API's `title` of a publication from its own act, not a heading.
 */
export function zonderKopInKapitalen(title: string): string {
	const i = title.lastIndexOf(': ');
	if (i < 0) return title;
	const staart = title.slice(i + 2);
	return /\p{Lu}{4}/u.test(staart) && !/\p{Ll}/u.test(staart) ? title.slice(0, i).trimEnd() : title;
}

/** The node's title from an answer of /api/nodes (`{ node: { id }, title }`). */
export function onthoudTitel(data: unknown) {
	if (!data || typeof data !== 'object') return;
	const { node, title } = data as { node?: { id?: unknown }; title?: unknown };
	const id = node?.id;
	if (typeof id !== 'string' || typeof title !== 'string' || !title.trim()) return;
	const t = zonderKopInKapitalen(title.trim());
	if (titels.get(id) !== t) titels.set(id, t);
}

/** The title the API gave the bron, or null before its node is in. Reactive. */
export const titelVan = (id: string): string | null => titels.get(id) ?? null;
