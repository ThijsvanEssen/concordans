// The browser's storage, which may refuse (a private window, blocked site data): a read then
// gives null and a write does nothing. The one place for its try/catch.

/** Storage that refused is no failure: said while developing only. */
function refused(key: string, e: unknown) {
	if (import.meta.env.DEV) console.debug(`storage ${key} (refused):`, e);
}

/** What is kept under `key`, or null. */
export function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch (e) {
		refused(key, e);
		return null;
	}
}

/** Keep `value` under `key`; null removes it. */
export function writeStored(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch (e) {
		refused(key, e);
	}
}
