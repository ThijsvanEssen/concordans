// The one place that builds a link to a bron. A link keeps the mode and the
// overlay of the view it stands in, so reading stays reading and the network
// stays the network.
import { page } from '$app/state';
import { isMode, parseNodeId, type Collection, type Mode } from '$lib/vocabulary';

/**
 * A bron as the interface holds it: its node key, and for a dossier also its number
 * (`37020-XV`, the node's `label`), which the API takes and a link carries.
 */
export type BronRef =
	| { collection: Exclude<Collection, 'dossiers'>; key: string }
	| { collection: 'dossiers'; key: string; number: string };

/** The ref of a node the API returned; a dossier node has its label in `props.label`. */
export const refOf = (
	collection: Collection,
	key: string,
	props?: Record<string, unknown> | null
): BronRef =>
	collection === 'dossiers'
		? { collection, key, number: typeof props?.label === 'string' ? props.label : '' }
		: { collection, key };

export type BronHrefOptions = {
	/** Position inside the text: `lid-2`, `lid-2-onder-a`, `aanhef`, `rov-5.3`. */
	at?: string | null;
	/** False opens the bron in `mode` (default Lezen) whatever the current mode is. */
	keepMode?: boolean;
	mode?: Mode;
};

/**
 * View state that belongs to the view, not to the bron, and travels along: the
 * overlay, the bronfilter and the depth of the network. What names a place in one
 * bron (`lid`, `jaar`, `zoek`, `tabel`) stays behind.
 */
const KEPT_PARAMS = [
	'overlay',
	'bronnen',
	'rechter',
	'van',
	'tot',
	'geldend',
	'betrouwbaarheid',
	'status',
	'diepte'
];

export const refId = (ref: BronRef) => `${ref.collection}/${ref.key}`;

/**
 * What a link names: `collection/key`, and `dossiers/<number>` for a dossier. A string
 * is taken as that name already (`dossiers/37020-XV`, `articles/bwbr0001854_287`).
 */
function focusOf(ref: BronRef | string): string | null {
	if (typeof ref === 'string') return parseNodeId(ref) ? ref : null;
	if (ref.collection !== 'dossiers') return refId(ref);
	return ref.number ? `dossiers/${ref.number}` : null;
}

export function buildBronHref(
	current: URL | null,
	ref: BronRef | string,
	{ at, keepMode = true, mode }: BronHrefOptions = {}
): string {
	const focus = focusOf(ref);
	if (!focus) return '/explore';
	const inExplore = current?.pathname === '/explore';
	const currentMode = inExplore ? current.searchParams.get('mode') : null;
	// Bladeren lists bronnen; opening one from there is reading it.
	const kept = keepMode && isMode(currentMode) && currentMode !== 'index' ? currentMode : null;

	const params = new URLSearchParams();
	params.set('mode', kept ?? mode ?? 'read');
	params.set('focus', focus);
	if (inExplore) {
		for (const name of KEPT_PARAMS) {
			const value = current.searchParams.get(name);
			if (value) params.set(name, value);
		}
	}
	// A node id is safe in a query string as it is; the escaped slash only hurts legibility.
	const query = params.toString().replaceAll('%2F', '/').replaceAll('%2C', ',');
	return `/explore?${query}${at ? `#${encodeURIComponent(at)}` : ''}`;
}

/** Link to a bron from the current page. Reactive where it is read in a template. */
export const bronHref = (ref: BronRef | string, opts?: BronHrefOptions) =>
	buildBronHref(page.url, ref, opts);
