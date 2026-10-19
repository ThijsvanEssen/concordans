// The browser asked to keep this site's storage (navigator.storage.persist), so it does not
// clear the bundels on its own: Safari clears a site's storage after seven days without a
// visit. Asked once a page, when the reader first keeps something: a browser that asks its
// user asks then, never on loading.
import { ignore } from '$lib/api/errors';

let asked = false;

/** Asks the browser to keep the storage, where it does not yet; once a page. */
export function keepStorage() {
	if (asked) return;
	asked = true;
	const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
	if (!storage?.persist) return;
	(storage.persisted ? storage.persisted() : Promise.resolve(false))
		.then((kept) => kept || storage.persist())
		// Refused: the browser keeps the storage as it does.
		.catch(ignore('opslag bewaren'));
}
