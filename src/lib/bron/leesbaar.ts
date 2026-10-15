// A bron at an address a lawyer can read and type: the official identifier in the path.
//
//   /uitspraken/ECLI:NL:HR:2019:2006     a judgment, by its ECLI (as rechtspraak.nl)
//   /wetten/BWBR0005289                  a law, by its BWB id
//   /wetten/32022L2555                   an EU act, by its CELEX number
//   /wetten/BWBR0005289/artikel/6:162    an article, by its law and number
//   /dossiers/36600-VIII                 a dossier, by its number
//   /kamerstukken/36799/31               a Kamerstuk, by its dossier and number
//   /kamerstukken/36600-VIII/AB          one of the Eerste Kamer, by its letter
//   /stb/2026/94                         a publication, by series, year and number
//   /leden/rob-jetten                    a lid or bewindspersoon, by the slug the API gives
//   /kabinetten/rutte_iv                 a cabinet, by its key
//   /fracties/d66                        a fractie, by its key (ek_democraten_1966 in the EK)
//   /commissies/szw                      a commissie, by its slug
//   /toezeggingen/TZ202609-124           a toezegging, by its number
//   /stemmingen/decision_154df5db_…      a stemming (a besluit), by its key
//   /zaken/2025Z15468                    a zaak, by its number (API 0.79.43, #502)
//   /activiteiten/2026A01323             an activiteit of the Tweede Kamer, by its number
//   /wetten/BWBR0002741/bijlage/II       a bijlage of a law, by its label
//
// Each is a second address of the Verkenner (`reroute` in src/hooks.ts serves /explore);
// the API ids stay as they are. The rest of the view stays in the query: ?lezen=1,
// ?netwerk=…, the bronfilter. `/explore?focus=…` keeps working and is replaced by the
// readable address once the bron is known.
import { SvelteMap } from 'svelte/reactivity';
import { onAnswer } from '$lib/api/client';
import { lookup } from '$lib/api/search';
import type { QueryOf } from '$lib/api/types';
import { ifExists, ignore } from '$lib/api/errors';
import { onthoudTitel } from './titels.svelte';
import { getArticleDetail, getArticleHistory, onthoudArtikel } from '$lib/api/articles';
import { lawArticleList } from '$lib/api/law-articles';
import { getDocument, getDossierDocuments, getExplainedBy } from '$lib/api/records';
import { wordingsOf } from '$lib/text/version-diff';
import { apiNumber } from '$lib/text/bw';
import { readableQuery } from '$lib/util/address';
import { parseNodeId } from '$lib/vocabulary';
import { onForget } from '$lib/util/forget';

export type Pad =
	| { soort: 'uitspraak'; ecli: string }
	| { soort: 'artikel'; wet: string; nummer: string }
	| { soort: 'wet'; wet: string }
	| { soort: 'dossier'; nummer: string }
	| { soort: 'kamerstuk'; dossier: string; nummer: string }
	| { soort: 'publicatie'; reeks: Reeks; jaar: string; nummer: string }
	| { soort: 'lid'; slug: string }
	| { soort: 'kabinet'; key: string }
	| { soort: 'fractie'; key: string }
	| { soort: 'commissie'; slug: string }
	| { soort: 'toezegging'; nummer: string }
	| { soort: 'stemming'; key: string }
	| { soort: 'zaak'; nummer: string }
	| { soort: 'activiteit'; nummer: string }
	| { soort: 'bijlage'; wet: string; label: string };

/** The series of officielebekendmakingen.nl a publication appears in. */
export type Reeks = 'stb' | 'stcrt' | 'trb';
const SERIES: readonly string[] = ['stb', 'stcrt', 'trb'] satisfies Reeks[];
/** The node key of a publication: its series, year and number, `stb_2026_94`. */
const PUBLICATION_KEY = new RegExp(`^(${SERIES.join('|')})_(\\d{4})_(\\d+)$`);

const segment = (s: string) => {
	try {
		return decodeURIComponent(s);
	} catch {
		return null;
	}
};

const ECLI = /^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+$/i;
const DOSSIER = /^\d{4,6}(-[A-Z0-9()]+)*$/i;
/** A law in the BWB by its id, which is its node key too: BWBR0005290. */
const BWB = /^BWBR\d{7}$/i;
/** An EU act by its CELEX number, its node key too: sector 3, year, kind, number (32022L2555). */
const CELEX = /^3\d{4}[CDFLR]\d+$/i;
/** A key or slug as the API gives it: `rutte_iv`, `ek_democraten_1966`, `buhaos-2021`. */
const KEY = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
/** The slug of a lid: words joined by hyphens, `rob-jetten`. */
const LID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The number of a toezegging: `TZ202609-124` (COMMITMENT_NUMBER in the API). */
const TOEZEGGING = /^TZ\d{6}-\d{1,5}$/i;
/** The number of a zaak: `2025Z15468`. */
const CASE_NUMBER = /^\d{4}Z\d+$/i;
/** The number of an activiteit of the Tweede Kamer: `2026A01323`. */
const ACTIVITY_NUMBER = /^\d{4}A\d+$/i;
/** The label of a bijlage: `II`, `1`, `2.A`, `B-1`. */
const ANNEX_LABEL = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/i;
/** The number of a stuk: a figure in the Tweede Kamer, letters in the Eerste (`A`, `AB`). */
const PAPER_NUMBER = /^(\d+|[A-Z]{1,3})$/i;

type AddressKind = Pad['soort'];
type PadOf<S extends AddressKind> = Extract<Pad, { soort: S }>;

/**
 * One kind of address: how it reads from the segments of a path, how it is written, what
 * /api/lookup is asked for it (a stemming: never, its key is its id), and for a kind whose
 * key is in its address, the focus it names without a request and the address of a key.
 */
type AddressRule<S extends AddressKind> = {
	read: (parts: readonly string[]) => PadOf<S> | null;
	write: (pad: PadOf<S>) => string;
	lookup?: (pad: PadOf<S>) => QueryOf<'/api/lookup'>;
	focus?: (pad: PadOf<S>) => string;
	fromKey?: (target: { collection: string; key: string }) => PadOf<S> | null;
};

const e = encodeURIComponent;
/** A colon is safe in a path segment, and reads better than %3A. */
const keep = (s: string) => e(s).replaceAll('%3A', ':');
/** The one segment after `first`, where it passes `test`. */
const single = (parts: readonly string[], first: string, test: RegExp) =>
	parts.length === 2 && parts[0] === first && test.test(parts[1]) ? parts[1] : null;

const ADDRESS_RULES: { [S in AddressKind]: AddressRule<S> } = {
	uitspraak: {
		read: (p) => {
			const ecli = single(p, 'uitspraken', ECLI);
			return ecli ? { soort: 'uitspraak', ecli: ecli.toUpperCase() } : null;
		},
		write: (pad) => `/uitspraken/${keep(pad.ecli)}`,
		lookup: (pad) => ({ kind: 'judgment', ecli: pad.ecli }),
		focus: (pad) => `judgments/${ecliKey(pad.ecli)}`,
		fromKey: ({ collection, key }) => {
			const ecli = collection === 'judgments' ? keyEcli(key) : null;
			return ecli ? { soort: 'uitspraak', ecli } : null;
		}
	},
	wet: {
		read: (p) => {
			const wet = single(p, 'wetten', BWB) ?? single(p, 'wetten', CELEX);
			return wet ? { soort: 'wet', wet: wet.toUpperCase() } : null;
		},
		write: (pad) => `/wetten/${e(pad.wet)}`,
		lookup: (pad) => ({ kind: 'law', law: pad.wet }),
		focus: (pad) => `instruments/${pad.wet.toLowerCase()}`,
		fromKey: ({ collection, key }) =>
			collection === 'instruments' && (BWB.test(key) || CELEX.test(key))
				? { soort: 'wet', wet: key.toUpperCase() }
				: null
	},
	bijlage: {
		read: ([first, wet, b, label, ...rest]) =>
			first === 'wetten' &&
			b === 'bijlage' &&
			!rest.length &&
			BWB.test(wet) &&
			ANNEX_LABEL.test(label)
				? { soort: 'bijlage', wet: wet.toUpperCase(), label: label.toUpperCase() }
				: null,
		write: (pad) => `/wetten/${e(pad.wet)}/bijlage/${e(pad.label)}`,
		lookup: (pad) => ({ kind: 'annex', law: pad.wet, label: pad.label })
	},
	artikel: {
		read: ([first, wet, b, nummer, ...rest]) =>
			first === 'wetten' && b === 'artikel' && !rest.length && wet && nummer
				? { soort: 'artikel', wet: wet.toUpperCase(), nummer }
				: null,
		write: (pad) => `/wetten/${e(pad.wet)}/artikel/${keep(pad.nummer)}`,
		lookup: (pad) => ({ kind: 'article', law: pad.wet, number: pad.nummer })
	},
	zaak: {
		read: (p) => {
			const nummer = single(p, 'zaken', CASE_NUMBER);
			return nummer ? { soort: 'zaak', nummer: nummer.toUpperCase() } : null;
		},
		write: (pad) => `/zaken/${pad.nummer}`,
		lookup: (pad) => ({ kind: 'case', number: pad.nummer })
	},
	activiteit: {
		read: (p) => {
			const nummer = single(p, 'activiteiten', ACTIVITY_NUMBER);
			return nummer ? { soort: 'activiteit', nummer: nummer.toUpperCase() } : null;
		},
		write: (pad) => `/activiteiten/${pad.nummer}`,
		lookup: (pad) => ({ kind: 'activity', number: pad.nummer })
	},
	dossier: {
		read: (p) => {
			const nummer = single(p, 'dossiers', DOSSIER);
			return nummer ? { soort: 'dossier', nummer: nummer.toUpperCase() } : null;
		},
		write: (pad) => `/dossiers/${e(pad.nummer)}`,
		lookup: (pad) => ({ kind: 'dossier', number: pad.nummer }),
		// The front end names a dossier by its number (36600-VIII), not its key (36600_viii).
		focus: (pad) => `dossiers/${pad.nummer}`,
		fromKey: ({ collection, key }) =>
			collection === 'dossiers' && DOSSIER.test(key)
				? { soort: 'dossier', nummer: key.toUpperCase() }
				: null
	},
	lid: {
		read: (p) => {
			const slug = single(p, 'leden', LID_SLUG);
			return slug ? { soort: 'lid', slug } : null;
		},
		write: (pad) => `/leden/${pad.slug}`,
		lookup: (pad) => ({ kind: 'member', id: pad.slug })
	},
	kabinet: {
		read: (p) => {
			const key = single(p, 'kabinetten', KEY);
			return key ? { soort: 'kabinet', key } : null;
		},
		write: (pad) => `/kabinetten/${pad.key}`,
		lookup: (pad) => ({ kind: 'cabinet', id: pad.key }),
		focus: (pad) => `cabinets/${pad.key}`,
		fromKey: ({ collection, key }) =>
			collection === 'cabinets' && KEY.test(key) ? { soort: 'kabinet', key } : null
	},
	fractie: {
		read: (p) => {
			const key = single(p, 'fracties', KEY);
			return key ? { soort: 'fractie', key } : null;
		},
		write: (pad) => `/fracties/${pad.key}`,
		lookup: (pad) => ({ kind: 'faction', id: pad.key }),
		focus: (pad) => `factions/${pad.key}`,
		fromKey: ({ collection, key }) =>
			collection === 'factions' && KEY.test(key) ? { soort: 'fractie', key } : null
	},
	commissie: {
		read: (p) => {
			const slug = single(p, 'commissies', KEY);
			return slug ? { soort: 'commissie', slug } : null;
		},
		write: (pad) => `/commissies/${pad.slug}`,
		lookup: (pad) => ({ kind: 'committee', id: pad.slug })
	},
	toezegging: {
		read: (p) => {
			const nummer = single(p, 'toezeggingen', TOEZEGGING);
			return nummer ? { soort: 'toezegging', nummer: nummer.toUpperCase() } : null;
		},
		write: (pad) => `/toezeggingen/${pad.nummer}`,
		lookup: (pad) => ({ kind: 'commitment', number: pad.nummer })
	},
	stemming: {
		read: (p) => {
			const key = single(p, 'stemmingen', KEY);
			return key ? { soort: 'stemming', key } : null;
		},
		write: (pad) => `/stemmingen/${pad.key}`,
		focus: (pad) => `decisions/${pad.key}`,
		fromKey: ({ collection, key }) =>
			collection === 'decisions' && KEY.test(key) ? { soort: 'stemming', key } : null
	},
	publicatie: {
		read: ([reeks, jaar, nummer, ...rest]) =>
			SERIES.includes(reeks) && !rest.length && /^\d{4}$/.test(jaar) && /^\d+$/.test(nummer)
				? { soort: 'publicatie', reeks: reeks as Reeks, jaar, nummer }
				: null,
		write: (pad) => `/${pad.reeks}/${pad.jaar}/${pad.nummer}`,
		// Its key is its id at officielebekendmakingen.nl: stb_2026_94 is /stb/2026/94.
		fromKey: ({ collection, key }) => {
			const m = PUBLICATION_KEY.exec(key);
			return collection === 'instruments' && m
				? { soort: 'publicatie', reeks: m[1] as Reeks, jaar: m[2], nummer: m[3] }
				: null;
		},
		lookup: (pad) => ({
			kind: 'publication',
			series: pad.reeks,
			year: pad.jaar,
			number: pad.nummer
		})
	},
	kamerstuk: {
		read: ([first, dossier, nummer, ...rest]) =>
			first === 'kamerstukken' && !rest.length && DOSSIER.test(dossier) && PAPER_NUMBER.test(nummer)
				? { soort: 'kamerstuk', dossier: dossier.toUpperCase(), nummer: nummer.toUpperCase() }
				: null,
		write: (pad) => `/kamerstukken/${e(pad.dossier)}/${e(pad.nummer)}`,
		lookup: (pad) => ({ kind: 'document', dossier: pad.dossier, number: pad.nummer })
	}
};

/** The description of a pad's kind, typed by that kind. */
const ruleOf = <S extends AddressKind>(pad: PadOf<S>) => ADDRESS_RULES[pad.soort] as AddressRule<S>;
const RULES = Object.values(ADDRESS_RULES) as AddressRule<AddressKind>[];

/** The readable address in a path, or null for any other page. */
export function parsePad(pathname: string): Pad | null {
	const parts = pathname.split('/').filter(Boolean).map(segment);
	if (parts.some((p) => p === null)) return null;
	for (const rule of RULES) {
		const pad = rule.read(parts as string[]);
		if (pad) return pad;
	}
	return null;
}

/** Whether a path is the Verkenner: /explore, or a readable address of a bron. */
export const isExplorePath = (pathname: string) =>
	pathname === '/explore' || parsePad(pathname) !== null;

/** The path of a readable address. */
export const padHref = (pad: Pad): string => ruleOf(pad).write(pad);

/**
 * A judgment's node key from its ECLI, as the API makes it (`make_node_key`): every run of
 * other characters one underscore, `ecli_nl_hr_2019_2006`, and the dot too:
 * `ECLI:BE:CASS:2019:ARR.20190101.1` is `ecli_be_cass_2019_arr_20190101_1`.
 */
export const ecliKey = (ecli: string): string =>
	ecli
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^_+|_+$/g, '');
/** The ECLI back from a key; null where a dot made the key ambiguous (the props have it). */
export const keyEcli = (key: string) =>
	/^ecli_[a-z]{2}_[a-z0-9]+_\d{4}_[a-z0-9]+$/.test(key)
		? key.toUpperCase().replaceAll('_', ':')
		: null;

// What was looked up, both ways: an address and the focus it names. Filled by the
// lookups below and by `remember`, so a second visit, and the link to a bron already
// seen, need no request.
const focusByPath = new SvelteMap<string, string>();
const pathByFocus = new SvelteMap<string, string>();

/** Keep an address and its focus together. */
export function remember(path: string, focus: string) {
	// A pair already kept is not written again: a list that remembers its rows on every load
	// would otherwise wake whatever reads the maps.
	if (focusByPath.get(path) === focus && pathByFocus.get(focus) === path) return;
	focusByPath.set(path, focus);
	pathByFocus.set(focus, path);
}

/**
 * The addresses the API gives (`path` beside `id`, on every bron it returns), kept as if
 * seen: a link to that bron is the API's address, not one built here. A dossier is left
 * out, since the front end names it by its number, not its key.
 */
export function onthoudPaden(data: unknown, depth = 0) {
	if (!data || typeof data !== 'object' || depth > 8) return;
	if (Array.isArray(data)) {
		for (const item of data) onthoudPaden(item, depth + 1);
		return;
	}
	const { path, key, member_key } = data as Record<string, unknown>;
	// A person is named by the key of the lid beside their address, without an id: a cabinet's
	// bewindspersonen, a stuk's indieners, the lid of a toezegging (UX-toets 0.79.47, #51).
	const lidKey = member_key ?? key;
	const id =
		(data as { id?: unknown }).id ??
		(typeof path === 'string' && path.startsWith('/leden/') && typeof lidKey === 'string'
			? `members/${lidKey}`
			: undefined);
	const address = typeof path === 'string' ? path : null;
	if (typeof id === 'string' && address && pathByFocus.get(id) !== address) {
		const target = parseNodeId(id);
		const pad = parsePad(address);
		if (target && pad && target.collection !== 'dossiers') {
			remember(padHref(pad), id);
			// The text of an article named here can stand in the reader before its node.
			if (pad.soort === 'artikel')
				onthoudArtikel(target.key, pad.wet.toUpperCase(), apiNumber(pad.wet, pad.nummer));
		}
	}
	for (const value of Object.values(data)) {
		if (value && typeof value === 'object') onthoudPaden(value, depth + 1);
	}
}
onAnswer((data) => {
	onthoudPaden(data);
	onthoudTitel(data);
});

/**
 * The focus an address names without a request: a judgment, a law, a dossier, a cabinet, a
 * fractie and a stemming (their key is in their address), or one seen.
 */
export const focusOfPad = (pad: Pad): string | null =>
	ruleOf(pad).focus?.(pad) ?? focusByPath.get(padHref(pad)) ?? null;

// The focus the server gave the page, with the address it gave it for: read once, used
// once. After a step in the app location.pathname is the new address while the meta still
// names the first page's bron (UX test 0.79.43, #28: HR 2019:2006, then a Kamerstuk, showed
// the judgment until a reload). The address is the document's own (its navigation entry),
// not the one of the moment.
let paginaFocus: { href: string; focus: string } | null | undefined;
onForget(() => {
	focusByPath.clear();
	pathByFocus.clear();
	paginaFocus = undefined;
});
function readPageFocus(): { href: string; focus: string } | null {
	const meta = document.querySelector('meta[name="focus"]');
	const focus = meta?.getAttribute('content') ?? null;
	meta?.remove();
	if (!focus || !parseNodeId(focus)) return null;
	const nav = performance.getEntriesByType?.('navigation')[0] as
		| PerformanceNavigationTiming
		| undefined;
	return { href: new URL(nav?.name || location.href).pathname, focus };
}

/**
 * The focus the server's page names (`<meta name="focus" content="documents/…">`, API
 * 0.79.43, #502): after the 301 from /explore?focus=… the key is no longer in the address,
 * and the page says it without a request (cold, the lookup took 1.8 s). Only for the address
 * the page was served for.
 */
export function focusUitPagina(pad: Pad): string | null {
	if (typeof document === 'undefined') return null;
	if (paginaFocus === undefined) paginaFocus = readPageFocus();
	const href = padHref(pad);
	if (!paginaFocus || paginaFocus.href !== href) return null;
	const { focus } = paginaFocus;
	paginaFocus = null;
	remember(href, focus);
	const target = parseNodeId(focus)!;
	// What the lookup would have set going: a Kamerstuk's text beside its node.
	if (target.collection === 'documents') askDocumentAhead(target.key);
	return focus;
}

/** An article's address as the API numbers it (162 for BW 6:162); null for another bron. */
const apiArticle = (pad: Pad) =>
	pad.soort === 'artikel'
		? { wet: pad.wet.toUpperCase(), nummer: apiNumber(pad.wet, pad.nummer) }
		: null;

/**
 * An article's text, asked as soon as its address is known, beside the lookup and the node,
 * so the reader finds it waiting (once() shares the request; Thijs, 10 Oct: lazy, the text
 * first). The text names the article's node key too: where it comes before the lookup, the
 * reader stands on it at once ($lib/bron/first-node). Its tekstversies date the status line ("tekst
 * sinds …"), the list of its law gives the place line and Vorig, Volgend, its explanations the
 * line of the memorie: asked with it, so the head does not grow over the text when they come.
 * By the API's own number (162 for BW 6:162), as the reader asks them. Nobody waits for these:
 * the reader asks again, and a failure is its to say.
 */
function askArticleAhead(pad: Pad, artikel: { wet: string; nummer: string }) {
	getArticleDetail(artikel.wet, artikel.nummer)
		.then((d) => {
			const href = padHref(pad);
			if (d.article?.id && !focusByPath.has(href)) remember(href, d.article.id);
		})
		.catch(ignore('leesbaar'));
	// Where no EXPLAINS edge names its memorie, the reader looks in the dossier of the wet
	// that gave its text in force: asked as soon as the tekstversies name it.
	getArticleHistory(artikel.wet, artikel.nummer)
		.then((h) => {
			const w = wordingsOf(h.versions ?? []).at(-1);
			const dossier = w && w.until === null ? w.first.amended_by?.dossiers?.[0]?.number : null;
			if (dossier) getDossierDocuments(dossier).catch(ignore('leesbaar'));
		})
		.catch(ignore('leesbaar'));
	lawArticleList(artikel.wet).catch(ignore('leesbaar'));
	getExplainedBy(artikel.wet, artikel.nummer).catch(ignore('leesbaar'));
}

/**
 * A Kamerstuk's text, asked as soon as its key is known, beside its node, not after it (live,
 * 10 Oct: the reader asked it only once the light node was in). The reader asks again.
 */
function askDocumentAhead(key: string) {
	getDocument(key).catch(ignore('leesbaar'));
}

/**
 * The focus of an address that needs the API, by /api/lookup: exact or nothing. A
 * Kamerstuk that is not in the data does not open its dossier instead. Null when the
 * data lacks it (404 `not_in_data`); another failure is thrown, to be said as such.
 */
export async function lookUp(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const artikel = apiArticle(pad);
	if (artikel) askArticleAhead(pad, artikel);
	const known = focusOfPad(pad) ?? focusUitPagina(pad);
	if (known) {
		const target = parseNodeId(known);
		if (artikel && target) onthoudArtikel(target.key, artikel.wet, artikel.nummer);
		return known;
	}
	return lookUpInData(pad, signal);
}

/**
 * The focus of an address as the data has it, always by /api/lookup: also where
 * `focusOfPad` would name it unasked (a dossier), for whoever must know it exists.
 */
export async function lookUpInData(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const artikel = apiArticle(pad);
	const query = ruleOf(pad).lookup?.(pad);
	if (!query) return null;
	const data = await ifExists(lookup(query, signal));
	if (!data) return null;
	const focus = `${data.collection}/${data.key}`;
	if (data.collection === 'documents') askDocumentAhead(data.key);
	// The reader stands on the article's detail, asked above, while its node is on its way.
	if (artikel) onthoudArtikel(data.key, artikel.wet, artikel.nummer);
	remember(padHref(pad), focus);
	return focus;
}

/**
 * The readable address of a focus: the one seen beside its id, else the `path` the API gave its
 * node, else the address its key makes for a kind whose key is in its address (a judgment, a
 * law, a dossier by its number, a cabinet, a fractie, a stemming); null where it has none.
 */
export function padOfFocus(focus: string, path?: string | null): string | null {
	const seen = pathByFocus.get(focus);
	if (seen) return seen;
	const given = path ? parsePad(path) : null;
	if (given) return padHref(given);
	const target = parseNodeId(focus);
	if (!target) return null;
	for (const rule of RULES) {
		const pad = rule.fromKey?.(target);
		if (pad) return padHref(pad);
	}
	return null;
}

/**
 * The URL as the Verkenner reads it: `/explore` with the focus in the query. An
 * address whose focus is not known yet reads without one, until `lookUp` finds it.
 */
export function exploreUrl(url: URL): URL {
	if (url.pathname === '/explore') return url;
	const pad = parsePad(url.pathname);
	if (!pad) return url;
	const logical = new URL(url);
	logical.pathname = '/explore';
	const focus = focusOfPad(pad);
	if (focus) logical.searchParams.set('focus', focus);
	return logical;
}

/** The focus of the Verkenner at a URL, from the query or the readable address. */
export const focusIn = (url: URL) => exploreUrl(url).searchParams.get('focus');

/**
 * The address of a view of the Verkenner: the readable path of its focus where it has
 * one, the rest in the query. `params` is the query as the Verkenner reads it; `given` the
 * path the API gave the focus's node.
 */
export function exploreHref(params: URLSearchParams, hash = '', given?: string | null): string {
	const focus = params.get('focus');
	const path = focus ? padOfFocus(focus, given) : null;
	const rest = new URLSearchParams(params);
	if (path) rest.delete('focus');
	const query = readableQuery(rest);
	return `${path ?? '/explore'}${query ? `?${query}` : ''}${hash}`;
}
