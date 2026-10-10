// The title of a bron as its page has it, from /api/nodes/{collection}/{key} (`title`, API
// 0.79.44, #529): the server's <title> without the site's name, one source for the server's
// head and the browser tab, never cut (Back-end #3, 10 Oct). The light node and the full one
// carry the same. Kept per node id as answers come in.
import { SvelteMap } from 'svelte/reactivity';

const titels = new SvelteMap<string, string>();

/** The node's title from an answer of /api/nodes (`{ node: { id }, title }`). */
export function onthoudTitel(data: unknown) {
	if (!data || typeof data !== 'object') return;
	const { node, title } = data as { node?: { id?: unknown }; title?: unknown };
	const id = node?.id;
	if (typeof id !== 'string' || typeof title !== 'string' || !title.trim()) return;
	if (titels.get(id) !== title.trim()) titels.set(id, title.trim());
}

/** The title the API gave the bron, or null before its node is in. Reactive. */
export const titelVan = (id: string): string | null => titels.get(id) ?? null;
