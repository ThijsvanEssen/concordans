// A page or a part of it that failed because a deploy removed its files: the page loads
// again, once per address, from the new release. Without a new version nothing happens and
// the failure stays shown. +error.svelte and the Verkenner's own chunks share the rule.
import { updated } from '$app/state';
import { report } from '$lib/api/errors';

/** Set when this tab reloaded for a new version; it reloads once per version. */
const RELOADED = 'concordans:herladen';

async function reloadIfUpdated() {
	if (!(await updated.check())) return;
	try {
		if (sessionStorage.getItem(RELOADED) === location.href) return;
		sessionStorage.setItem(RELOADED, location.href);
	} catch {
		// Without storage a reload could repeat itself: the failure stays shown instead.
		return;
	}
	location.reload();
}

export function reloadForNewVersion(): void {
	reloadIfUpdated().catch((e) => report('Nieuwe versie', e));
}
