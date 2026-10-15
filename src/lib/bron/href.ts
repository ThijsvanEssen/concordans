// The one place that builds a link to a bron. The Verkenner is the network; a bron
// with a text of its own can be read at full width instead (?lezen=1). A link keeps
// that and the overlay of the view it stands in, so reading stays reading and the
// network stays the network. From outside the Verkenner a bron opens to be read.
import { page } from '$app/state';
import { parseNodeId, type Collection, type Mode } from '$lib/vocabulary';
import { isVerkenner, verkennerHref, verkennerUrl } from './leesbaar';
import type { SharedParam } from '$lib/url/filters';

/** Bronnen with a text long enough to read at full width; the rest reads beside the network. */
const READABLE: ReadonlySet<Collection> = new Set([
	'articles',
	'instruments',
	'judgments',
	'documents'
]);
export const isReadable = (collection: Collection) => READABLE.has(collection);

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

type BronHrefOptions = {
	/** Position inside the text: `lid-2`, `lid-2-onder-a`, `aanhef`, `rov-5.3`. */
	at?: string | null;
	/** False opens the bron in `mode` whatever the current view is. */
	keepMode?: boolean;
	/** From outside the Verkenner, or with `keepMode` false: `read` (the default) or `graph`. */
	mode?: Exclude<Mode, 'index'>;
	/** False leaves the netwerk behind: the bron opens as the focus of a canvas of its own. */
	keepNetwerk?: boolean;
	/** On a phone, the tab the link opens: the text or the network. Read once and dropped. */
	paneel?: 'tekst' | 'netwerk';
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
	'tussen'
];

const NETWERK_PARAMS = new Set(['netwerk', 'uit', 'tussen']);

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
	{ at, keepMode = true, mode, keepNetwerk = true, paneel, params: own }: BronHrefOptions = {}
): string {
	const focus = focusOf(ref);
	const target = focus && parseNodeId(focus);
	if (!focus || !target) return '/explore';
	const inExplore = !!current && isVerkenner(current.pathname);
	if (current && inExplore) current = verkennerUrl(current);
	const currentMode = inExplore && current ? current.searchParams.get('mode') : null;
	// Bladeren lists bronnen; opening one from there is reading it.
	const within = keepMode && inExplore && currentMode !== 'index';
	const reading =
		within && current ? current.searchParams.get('lezen') === '1' : (mode ?? 'read') === 'read';

	const params = new URLSearchParams();
	params.set('focus', focus);
	if (reading && isReadable(target.collection)) params.set('lezen', '1');
	// A link to the network (In het netwerk, Alleen de omgeving): on a phone the Verkenner
	// opens its Netwerk tab, not the text (Thijs, 9 Oct). A link that opens a text asks for
	// the Tekst tab, wherever on the phone it was clicked. Read once and dropped.
	if (!within && mode === 'graph') params.set('paneel', 'netwerk');
	else if (!within && paneel === 'tekst' && reading && isReadable(target.collection))
		params.set('paneel', 'tekst');
	if (inExplore && current) {
		for (const name of KEPT_PARAMS) {
			if (!keepNetwerk && NETWERK_PARAMS.has(name)) continue;
			if (currentMode === 'index' && BRONNEN_PARAMS.has(name)) continue;
			const value = current.searchParams.get(name);
			if (value) params.set(name, value);
		}
	}
	for (const [name, value] of Object.entries(own ?? {})) params.set(name, value);
	return verkennerHref(params, at ? `#${encodeURIComponent(at)}` : '');
}

/**
 * A Kamerstuk opens on its text (Thijs, 12 Oct 2026: "op de tekst openen"), its network one
 * step further, as the Netwerk/Tekst switch or tab. One whose text is not in the data yet
 * (`has_text` false) opens in the network, as every other bron does (Thijs, 10 Oct:
 * "standaard navigeren naar Netwerk").
 */
const opensOnText = (collection: Collection, hasText?: boolean | null) =>
	collection === 'documents' && hasText !== false;

type OpenHrefOptions = {
	/** Position inside the text: `lid-2`, `rov-5.3`. */
	at?: string | null;
	/** Whether the bron's text is in the data, where the payload says (`has_text`). */
	hasText?: boolean | null;
};

/**
 * The one link a click on a bron follows, wherever it stands: a BronLink, a row of
 * Verbonden, a line of a tijdlijn, a row of Bladeren. A link that names the network
 * (In het netwerk) builds its own with `mode: 'graph'`.
 */
export function buildOpenHref(
	current: URL | null,
	ref: BronRef | string,
	{ at, hasText }: OpenHrefOptions = {}
): string {
	const target = parseNodeId(focusOf(ref) ?? '');
	return target && opensOnText(target.collection, hasText)
		? buildBronHref(current, ref, { at, keepMode: false, mode: 'read', paneel: 'tekst' })
		: buildBronHref(current, ref, { at, keepMode: false, mode: 'graph' });
}

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
