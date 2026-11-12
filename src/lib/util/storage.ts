// The browser's storage, which may refuse (a private window, blocked site data, a page drawn
// on the server): a read then gives null and a write does nothing. The one place for its
// try/catch. `local` keeps for this browser, `session` for this tab.

type Store = 'local' | 'session';

/** What headings a reader opened, per kind: the app (dicht.svelte.ts) and the first paint. */
export const FOLDS_KEY = 'concordans:kopjes';

/** Storage that refused is no failure: said while developing only. */
function refused(key: string, e: unknown) {
	if (import.meta.env.DEV) console.debug(`storage ${key} (refused):`, e);
}

const storage = (store: Store): Storage =>
	store === 'session' ? globalThis.sessionStorage : globalThis.localStorage;

/** What is kept under `key`, or null. */
export function readStored(key: string, store: Store = 'local'): string | null {
	try {
		return storage(store).getItem(key);
	} catch (e) {
		refused(key, e);
		return null;
	}
}

/** Keep `value` under `key`; null removes it. False where the browser kept nothing. */
export function writeStored(key: string, value: string | null, store: Store = 'local'): boolean {
	try {
		if (value === null) storage(store).removeItem(key);
		else storage(store).setItem(key, value);
		return true;
	} catch (e) {
		refused(key, e);
		return false;
	}
}

/**
 * What is kept under `key` as JSON, through `read`, which takes what it knows from the raw
 * value (a kept value may be of an older version, or written by hand). Null where nothing is
 * kept, or nothing readable.
 */
export function readJson<T>(store: Store, key: string, read: (raw: unknown) => T): T | null {
	const text = readStored(key, store);
	if (text === null) return null;
	try {
		return read(JSON.parse(text));
	} catch (e) {
		refused(key, e);
		return null;
	}
}

/** Keep `value` under `key` as JSON; null removes it. False where the browser kept nothing. */
export const writeJson = (store: Store, key: string, value: unknown): boolean =>
	writeStored(key, value === null ? null : JSON.stringify(value), store);

/** A plain object as kept: its entries, else none. */
export const entriesOf = (raw: unknown): [string, unknown][] =>
	raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.entries(raw) : [];

/** An array as kept, else empty. */
export const arrayOf = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);
