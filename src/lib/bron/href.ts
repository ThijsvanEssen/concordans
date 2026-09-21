// The one place that builds a link to a bron. A link keeps the mode and the
// overlay of the view it stands in, so reading stays reading and the network
// stays the network.
import { page } from '$app/state';
import { isMode, parseNodeId, type Collection, type Mode } from '$lib/vocabulary';

export type BronRef = { collection: Collection; key: string };

export type BronHrefOptions = {
	/** Position inside the text: `lid-2`, `lid-2-onder-a`, `aanhef`, `rov-5.3`. */
	at?: string | null;
	/** False opens the bron in `mode` (default Lezen) whatever the current mode is. */
	keepMode?: boolean;
	mode?: Mode;
};

/** View state that belongs to the view, not to the bron, and travels along. */
const KEPT_PARAMS = ['overlay'];

export const toRef = (ref: BronRef | string): BronRef | null =>
	typeof ref === 'string' ? parseNodeId(ref) : ref;

export const refId = (ref: BronRef) => `${ref.collection}/${ref.key}`;

export function buildBronHref(
	current: URL | null,
	ref: BronRef | string,
	{ at, keepMode = true, mode }: BronHrefOptions = {}
): string {
	const target = toRef(ref);
	if (!target) return '/explore';
	const inExplore = current?.pathname === '/explore';
	const currentMode = inExplore ? current.searchParams.get('mode') : null;
	// Bladeren lists bronnen; opening one from there is reading it.
	const kept = keepMode && isMode(currentMode) && currentMode !== 'index' ? currentMode : null;

	const params = new URLSearchParams();
	params.set('mode', kept ?? mode ?? 'read');
	params.set('focus', refId(target));
	if (inExplore) {
		for (const name of KEPT_PARAMS) {
			const value = current.searchParams.get(name);
			if (value) params.set(name, value);
		}
	}
	// A node id is safe in a query string as it is; the escaped slash only hurts legibility.
	const query = params.toString().replaceAll('%2F', '/');
	return `/explore?${query}${at ? `#${encodeURIComponent(at)}` : ''}`;
}

/** Link to a bron from the current page. Reactive where it is read in a template. */
export const bronHref = (ref: BronRef | string, opts?: BronHrefOptions) =>
	buildBronHref(page.url, ref, opts);
