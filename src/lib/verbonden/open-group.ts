// A request from the canvas to Verbonden: open the group that lists the bronnen of a kind
// (a cluster bron's "Bekijk in Verbonden"). Verbonden opens it and scrolls it into view.
import { writable } from 'svelte/store';
import type { Collection } from '$lib/vocabulary';

export const groupRequest = writable<{ collection: Collection; at: number } | null>(null);

export const openGroup = (collection: Collection) =>
	groupRequest.set({ collection, at: Date.now() });

/**
 * The group of `groups` that lists the most bronnen of `collection`, or null where none lists
 * one. The one answer for both ends: the canvas offers "Bekijk in Verbonden" only where
 * Verbonden has a group to open.
 */
export function groupFor<G extends { rows: readonly { ref: { collection: string } }[] }>(
	groups: readonly G[],
	collection: string
): G | null {
	const count = (g: G) => g.rows.filter((row) => row.ref.collection === collection).length;
	const best = [...groups].sort((a, b) => count(b) - count(a))[0];
	return best && count(best) > 0 ? best : null;
}
