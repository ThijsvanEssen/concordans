// The one place that builds a link to a bron. A bron opens in Tekst: its reader with Verbonden
// beside it, whatever its kind and also at its bare address (besluit 32, B14). The network
// around it is Samenhang, the canvas (?mode=netwerk). A link keeps the view it stands in and
// its overlay, so reading stays reading and the network stays the network.
import { page } from '$app/state';
import { parseNodeId, type Mode } from '$lib/vocabulary';
import { isExplorePath, exploreHref, exploreUrl } from './address';
import type { BronRef } from './ref';
import type { SharedParam } from '$lib/url/filters';

/** The value of ?mode that shows a bron on the canvas of Samenhang. */
export const NETWORK_MODE = 'netwerk';

/**
 * Bladeren is ?mode=index, whatever else the address holds. Without a bron the Verkenner is
 * the werkplek Netwerk; a bron is read in Tekst unless the address asks for the werkplek
 * (?mode=netwerk), a netwerk of chosen bronnen in the address or not (besluit 39). The table
 * of its verbindingen is read so too.
 */
export function exploreMode(params: URLSearchParams, readable = false): Mode {
	const mode = params.get('mode');
	if (mode === 'index') return 'index';
	// A readable address names its bron, also while it is looked up (`readable`).
	if (!params.get('focus') && !readable) return 'graph';
	if (params.get('tabel') === '1') return 'read';
	return mode === NETWORK_MODE ? 'graph' : 'read';
}

/** The view an address shows: null off /explore and the readable addresses of bronnen. */
export const modeOf = (url: URL): Mode | null =>
	isExplorePath(url.pathname)
		? exploreMode(exploreUrl(url).searchParams, url.pathname !== '/explore')
		: null;

/** The address opens a bron: its readable address, or /explore with ?focus. */
export const hasFocus = (url: URL): boolean =>
	url.pathname === '/explore'
		? Boolean(url.searchParams.get('focus'))
		: isExplorePath(url.pathname);

type BronHrefOptions = {
	/** Position inside the text: `lid-2`, `lid-2-onder-a`, `aanhef`, `rov-5.3`. */
	at?: string | null;
	/** False opens the bron in `mode` whatever the current view is. */
	keepMode?: boolean;
	/** From outside the Verkenner, or with `keepMode` false: `read` (the default) or `graph`. */
	mode?: Exclude<Mode, 'index'>;
	/** False leaves the netwerk behind: the bron opens as the focus of a canvas of its own. */
	keepNetwerk?: boolean;
	/** Params of the target's own, such as the peildatum of the law it was opened from. */
	params?: Record<string, string>;
};

/**
 * View state that belongs to the view, not to the bron, and travels along: the
 * overlay, the bronfilter, the depth of the network and the netwerk of chosen
 * bronnen. What names a place in one bron (`lid`, `jaar`, `q`, `tabel`) stays behind.
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
	'diepte',
	'netwerk',
	'uit',
	'tussen',
	'omgeving'
];

const NETWERK_PARAMS = new Set(['netwerk', 'uit', 'tussen', 'omgeving']);

/** The kept params that Bronnen names a filter of its own by (its period): left there. */
const BRONNEN_PARAMS = new Set(['van', 'tot', 'status']);

export const refId = (ref: BronRef) => `${ref.collection}/${ref.key}`;

/**
 * What a link names: `collection/key`, and `dossiers/<number>` for a dossier. A string
 * is taken as that name already (`dossiers/37020-XV`, `articles/bwbr0001854_287`).
 */
export function focusOf(ref: BronRef | string): string | null {
	if (typeof ref === 'string') return parseNodeId(ref) ? ref : null;
	if (ref.collection !== 'dossiers') return refId(ref);
	return ref.number ? `dossiers/${ref.number}` : null;
}

export function buildBronHref(
	current: URL | null,
	ref: BronRef | string,
	{ at, keepMode = true, mode, keepNetwerk = true, params: own }: BronHrefOptions = {}
): string {
	const focus = focusOf(ref);
	const target = focus && parseNodeId(focus);
	if (!focus || !target) return '/explore';
	const onExplorePath = !!current && isExplorePath(current.pathname);
	const readable = !!current && onExplorePath && current.pathname !== '/explore';
	if (current && onExplorePath) current = exploreUrl(current);
	const currentMode = onExplorePath && current ? current.searchParams.get('mode') : null;
	// Bladeren lists bronnen; opening one from there is reading it.
	const within = keepMode && onExplorePath && currentMode !== 'index';
	const reading =
		within && current
			? exploreMode(current.searchParams, readable) === 'read'
			: (mode ?? 'read') === 'read';

	const params = new URLSearchParams();
	params.set('focus', focus);
	if (!reading) params.set('mode', NETWORK_MODE);
	// A link to the network (In het netwerk, Alleen de omgeving): on a phone the Verkenner
	// opens its Netwerk tab, not the text (Thijs, 9 Oct). Read once and dropped.
	if (!within && mode === 'graph') params.set('paneel', 'netwerk');
	if (onExplorePath && current) {
		for (const name of KEPT_PARAMS) {
			// A bron read leaves the netwerk in the werkplek's address: Back brings it back.
			if ((!keepNetwerk || reading) && NETWERK_PARAMS.has(name)) continue;
			if (currentMode === 'index' && BRONNEN_PARAMS.has(name)) continue;
			const value = current.searchParams.get(name);
			if (value) params.set(name, value);
		}
	}
	for (const [name, value] of Object.entries(own ?? {})) params.set(name, value);
	return exploreHref(params, at ? `#${encodeURIComponent(at)}` : '');
}

type OpenHrefOptions = {
	/** Position inside the text: `lid-2`, `rov-5.3`. */
	at?: string | null;
};

/**
 * The one link a click on a bron follows, wherever it stands: a BronLink, a row of
 * Verbonden, a line of a tijdlijn, a row of Bladeren. Every bron opens in Tekst (besluit 32);
 * a link that names the network (In het netwerk) builds its own with `mode: 'graph'`.
 */
export const buildOpenHref = (
	current: URL | null,
	ref: BronRef | string,
	{ at }: OpenHrefOptions = {}
): string => buildBronHref(current, ref, { at, keepMode: false, mode: 'read' });

/** Link to a bron from the current page. Reactive where it is read in a template. */
export const bronHref = (ref: BronRef | string, opts?: BronHrefOptions) =>
	buildBronHref(page.url, ref, opts);

/** The link a click on a bron follows (buildOpenHref), from the current page. */
export const openHref = (ref: BronRef | string, opts?: OpenHrefOptions) =>
	buildOpenHref(page.url, ref, opts);

/** A list in Bladeren, with its filters: `/explore?mode=index&kind=ministers&kabinet=rutte_iv`. */
export function indexHref(
	kind: string,
	filters: { [K in SharedParam | 'status']?: string } = {}
): string {
	const params = new URLSearchParams({ mode: 'index', kind, ...filters });
	return `/explore?${params.toString()}`;
}
