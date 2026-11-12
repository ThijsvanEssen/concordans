// A page or a part of it that failed because a deploy removed its files: the page loads
// again, once per address, from the new release. Without a new version nothing happens and
// the failure stays shown. +error.svelte and the Verkenner's own chunks share the rule.
import { updated } from '$app/state';
import { report } from '$lib/api/errors';
import { readStored, writeStored } from '$lib/util/storage';

/** Set when this tab reloaded for a new version; it reloads once per version. */
const RELOADED = 'concordans:herladen';

async function reloadIfUpdated() {
	if (!(await updated.check())) return;
	if (readStored(RELOADED, 'session') === location.href) return;
	// Without storage a reload could repeat itself: the failure stays shown instead.
	if (writeStored(RELOADED, location.href, 'session')) location.reload();
}

export function reloadForNewVersion(): void {
	reloadIfUpdated().catch((e) => report('Nieuwe versie', e));
}
