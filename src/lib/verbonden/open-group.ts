// A request from the canvas to Verbonden: open the group that lists the bronnen of a kind
// (a cluster bron's "Bekijk in Verbonden"). Verbonden opens it and scrolls it into view.
import { writable } from 'svelte/store';
import type { Collection } from '$lib/vocabulary';

export const groupRequest = writable<{ collection: Collection; at: number } | null>(null);

export const openGroup = (collection: Collection) =>
	groupRequest.set({ collection, at: Date.now() });
