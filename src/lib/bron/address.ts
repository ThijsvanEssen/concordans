// A bron at an address a lawyer can read and type: the official identifier in the path.
//
//   /uitspraken/ECLI:NL:HR:2019:2006     a judgment, by its ECLI (as rechtspraak.nl)
//   /wetten/BWBR0005289                  a law, by its BWB id
//   /wetten/32022L2555                   an EU act, by its CELEX number
//   /wetten/STB-2026-56                  a law the BWB does not hold (yet), by the
//                                        Staatsblad publication that enacted it
//   /wetten/BWBR0005289/artikel/6:162    an article, by its law and number
//   /dossiers/36600-VIII                 a dossier, by its number
//   /kamerstukken/36799/31               a Kamerstuk, by its dossier and number
//   /kamerstukken/36600-VIII/AB          one of the Eerste Kamer, by its letter
//   /stb/2026/94                         a publication, by series, year and number
//   /leden/rob-jetten                    a lid or bewindspersoon, by the slug the API gives
//   /kabinetten/rutte_iv                 a cabinet, by its key
//   /ministeries/jenv                    a ministry, by its key
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
//
// Only the grammar of an address and what is known of it: a link to a bron builds its
// address here without loading the resolver (./leesbaar, which asks the API).
import { SvelteMap } from 'svelte/reactivity';
import type { QueryOf } from '$lib/api/types';
import { readableQuery } from '$lib/util/address';
import { parseNodeId } from '$lib/vocabulary';
import { ecliKey, keyEcli } from '$lib/text/ecli';
import { onForget } from '$lib/util/forget';
import { enactedLawOfKey, lawNodeKey, STB_LAW } from '$lib/text/enacted-law';

export type Pad =
	| { soort: 'uitspraak'; ecli: string }
	| { soort: 'artikel'; wet: string; nummer: string }
	| { soort: 'wet'; wet: string }
	| { soort: 'dossier'; nummer: string }
	| { soort: 'kamerstuk'; dossier: string; nummer: string }
	| { soort: 'publicatie'; reeks: Reeks; jaar: string; nummer: string }
	| { soort: 'lid'; slug: string }
	| { soort: 'kabinet'; key: string }
	| { soort: 'ministerie'; key: string }
	| { soort: 'fractie'; key: string }
	| { soort: 'commissie'; slug: string }
	| { soort: 'toezegging'; nummer: string }
	| { soort: 'stemming'; key: string }
	| { soort: 'zaak'; nummer: string }
	| { soort: 'activiteit'; nummer: string }
	| { soort: 'bijlage'; wet: string; label: string };

/** The series of officielebekendmakingen.nl a publication appears in. */
type Reeks = 'stb' | 'stcrt' | 'trb';
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
/** A law or a treaty in the BWB by its id, which is its node key too: BWBR0005290, BWBV0007162. */
const BWB = /^BWB[RV]\d{7}$/i;
/** An EU act by its CELEX number, its node key too: sector 3, year, kind, number (32022L2555). */
const CELEX = /^3\d{4}[CDFLR]\d+$/i;
/** Whether an identifier is a CELEX number of an EU act: `32017R1001`. */
export const isCelex = (id: string): boolean => CELEX.test(id);
/** Whether a law in an address is named by its id (BWB, CELEX, Staatsblad), not a name. */
export const isLawId = (wet: string): boolean =>
	BWB.test(wet) || CELEX.test(wet) || STB_LAW.test(wet);
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
			const wet =
				single(p, 'wetten', BWB) ?? single(p, 'wetten', CELEX) ?? single(p, 'wetten', STB_LAW);
			return wet ? { soort: 'wet', wet: wet.toUpperCase() } : null;
		},
		write: (pad) => `/wetten/${e(pad.wet)}`,
		lookup: (pad) => ({ kind: 'law', id: pad.wet }),
		focus: (pad) => `instruments/${lawNodeKey(pad.wet)}`,
		fromKey: ({ collection, key }) => {
			if (collection !== 'instruments') return null;
			if (BWB.test(key) || CELEX.test(key)) return { soort: 'wet', wet: key.toUpperCase() };
			const enacted = enactedLawOfKey(key);
			return enacted ? { soort: 'wet', wet: enacted } : null;
		}
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
	ministerie: {
		read: (p) => {
			const key = single(p, 'ministeries', KEY);
			return key ? { soort: 'ministerie', key } : null;
		},
		write: (pad) => `/ministeries/${pad.key}`,
		lookup: (pad) => ({ kind: 'ministry', id: pad.key }),
		focus: (pad) => `ministries/${pad.key}`,
		fromKey: ({ collection, key }) =>
			collection === 'ministries' && KEY.test(key) ? { soort: 'ministerie', key } : null
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

/** The focus kept for an address. */
export const keptFocus = (path: string) => focusByPath.get(path);
/** The address kept for a focus. */
export const keptPath = (focus: string) => pathByFocus.get(focus);
onForget(() => {
	focusByPath.clear();
	pathByFocus.clear();
});

/** What /api/lookup is asked for an address that needs it; undefined where its key is in it. */
export const lookupQuery = (pad: Pad) => ruleOf(pad).lookup?.(pad);

/**
 * The focus an address names without a request: a judgment, a law, a dossier, a cabinet, a
 * fractie and a stemming (their key is in their address), or one seen.
 */
export const focusOfPad = (pad: Pad): string | null =>
	ruleOf(pad).focus?.(pad) ?? focusByPath.get(padHref(pad)) ?? null;

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
