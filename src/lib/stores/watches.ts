import { writable, derived } from 'svelte/store';
import { getWatches, createWatch, deleteWatch } from '$lib/api/parliamentary-client';
import type { WatchEntry, WatchEntityType } from '$lib/api/parliamentary';

const STORAGE_KEY = 'concordans:watches';
const LEGACY_STORAGE_KEY = 'lawgraph:watches';

const isClient = () => typeof window !== 'undefined';

function loadFromStorage(): WatchEntry[] {
  if (!isClient()) return [];
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    // Eenmalige migratie van de oude sleutel. Bestaande watches blijven
    // behouden; de oude sleutel wordt opgeruimd zodra de nieuwe geschreven is.
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    return raw ? (JSON.parse(raw) as WatchEntry[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: WatchEntry[]) {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the in-memory store still works.
  }
}

const _store = writable<WatchEntry[]>(loadFromStorage());
_store.subscribe((items) => saveToStorage(items));

// Maps entity id → backend watch record id (for DELETE).
// Populated lazily on first add and on startup bootstrap.
const _backendIds = new Map<string, string>();

// Bootstrap: fetch existing backend watches to get their record IDs.
// Best-effort — if the backend is unavailable, localStorage still works.
if (isClient()) {
  getWatches()
    .then((bws) => {
      for (const bw of bws) {
        _backendIds.set(bw.node_id, bw.id);
      }
    })
    .catch(() => {});
}

export const watches = derived(_store, ($w) => $w);

export function addWatch(entry: Omit<WatchEntry, 'watchedAt'>) {
  // Optimistic local update
  _store.update((items) => {
    if (items.some((w) => w.id === entry.id)) return items;
    return [...items, { ...entry, watchedAt: Date.now() }];
  });

  // Persist to backend (fire-and-forget)
  createWatch({
    node_id: entry.id,
    label: entry.label,
    collection: entry.entityType,
  })
    .then((out) => { _backendIds.set(entry.id, out.id); })
    .catch(() => { /* offline-friendly — localStorage persists locally */ });
}

export function removeWatch(id: string) {
  // Optimistic local update
  _store.update((items) => items.filter((w) => w.id !== id));

  // Delete from backend (fire-and-forget)
  const backendId = _backendIds.get(id);
  if (backendId) {
    _backendIds.delete(id);
    deleteWatch(backendId).catch(() => {});
  }
}

export function hasWatch(id: string): boolean {
  let result = false;
  _store.subscribe((items) => { result = items.some((w) => w.id === id); })();
  return result;
}

export function watchesForType(type: WatchEntityType) {
  return derived(_store, ($w) => $w.filter((w) => w.entityType === type));
}
