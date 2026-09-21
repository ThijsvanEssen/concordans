import { writable, get } from 'svelte/store';
import { api, unwrap, writes } from '$lib/api/client';
import { parseNodeId, type NodeId } from '$lib/vocabulary';

export interface WatchEntry {
	id: NodeId;
	label: string;
	href: string;
	watchedAt: number;
}

const STORAGE_KEY = 'concordans:watches';
const isClient = typeof window !== 'undefined';

function loadFromStorage(): WatchEntry[] {
	if (!isClient) return [];
	try {
		return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as WatchEntry[];
	} catch {
		return [];
	}
}

const store = writable<WatchEntry[]>(loadFromStorage());
store.subscribe((items) => {
	if (!isClient) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch {
		// Storage full or blocked: the in-memory list still works.
	}
});

export const watches = { subscribe: store.subscribe };

// Node id to the API's watch id, which a delete needs.
const apiIds = new Map<string, string>();

if (isClient) {
	unwrap(api.GET('/api/watches'))
		.then((list) => list.forEach((w) => apiIds.set(w.node_id, w.id)))
		.catch(() => {});
}

export function addWatch(entry: Omit<WatchEntry, 'watchedAt'>) {
	store.update((items) =>
		items.some((w) => w.id === entry.id) ? items : [...items, { ...entry, watchedAt: Date.now() }]
	);
	unwrap(
		writes.POST('/api/watches', {
			body: {
				node_id: entry.id,
				label: entry.label,
				collection: parseNodeId(entry.id)?.collection
			}
		})
	)
		.then((watch) => apiIds.set(entry.id, watch.id))
		.catch(() => {});
}

export function removeWatch(id: NodeId) {
	store.update((items) => items.filter((w) => w.id !== id));
	const apiId = apiIds.get(id);
	if (!apiId) return;
	apiIds.delete(id);
	writes
		.DELETE('/api/watches/{watch_id}', { params: { path: { watch_id: apiId } } })
		.catch(() => {});
}

export const hasWatch = (id: NodeId) => get(store).some((w) => w.id === id);
