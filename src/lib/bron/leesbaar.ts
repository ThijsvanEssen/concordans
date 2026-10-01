// A bron at an address a lawyer can read and type: the official identifier in the path.
//
//   /uitspraken/ECLI:NL:HR:2019:2006     a judgment, by its ECLI (as rechtspraak.nl)
//   /wetten/BWBR0005289/artikel/6:162    an article, by its law and number
//   /dossiers/36600-VIII                 a dossier, by its number
//   /kamerstukken/36799/31               a Kamerstuk, by its dossier and number
//   /kamerstukken/36600-VIII/AB          one of the Eerste Kamer, by its letter
//   /stb/2026/94                         a publication, by series, year and number
//
// Each is a second address of the Verkenner (`reroute` in src/hooks.ts serves /explore);
// the API ids stay as they are. The rest of the view stays in the query: ?lezen=1,
// ?netwerk=…, the bronfilter. `/explore?focus=…` keeps working and is replaced by the
// readable address once the bron is known.
import { SvelteMap } from 'svelte/reactivity';
import { api } from '$lib/api/client';
import { bookNumber } from '$lib/text/bw';
import { parseNodeId } from '$lib/vocabulary';

export type Pad =
	| { soort: 'uitspraak'; ecli: string }
	| { soort: 'artikel'; wet: string; nummer: string }
	| { soort: 'dossier'; nummer: string }
	| { soort: 'kamerstuk'; dossier: string; nummer: string }
	| { soort: 'publicatie'; reeks: Reeks; jaar: string; nummer: string };

/** The series of officielebekendmakingen.nl a publication appears in. */
export type Reeks = 'stb' | 'stcrt' | 'trb';
const REEKSEN: readonly string[] = ['stb', 'stcrt', 'trb'];

const segment = (s: string) => {
	try {
		return decodeURIComponent(s);
	} catch {
		return null;
	}
};

const ECLI = /^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+$/i;
const DOSSIER = /^\d{4,6}(-[A-Z0-9()]+)*$/i;
/** The number of a stuk: a figure in the Tweede Kamer, letters in the Eerste (`A`, `AB`). */
const STUK = /^(\d+|[A-Z]{1,3})$/i;

/** The readable address in a path, or null for any other page. */
export function parsePad(pathname: string): Pad | null {
	const parts = pathname.split('/').filter(Boolean).map(segment);
	if (parts.some((p) => p === null)) return null;
	const [first, a, b, c] = parts as string[];
	if (first === 'uitspraken' && parts.length === 2 && ECLI.test(a))
		return { soort: 'uitspraak', ecli: a.toUpperCase() };
	if (first === 'wetten' && parts.length === 4 && b === 'artikel' && a && c)
		return { soort: 'artikel', wet: a.toUpperCase(), nummer: c };
	if (first === 'dossiers' && parts.length === 2 && DOSSIER.test(a))
		return { soort: 'dossier', nummer: a.toUpperCase() };
	if (REEKSEN.includes(first) && parts.length === 3 && /^\d{4}$/.test(a) && /^\d+$/.test(b))
		return { soort: 'publicatie', reeks: first as Reeks, jaar: a, nummer: b };
	if (first === 'kamerstukken' && parts.length === 3 && DOSSIER.test(a) && STUK.test(b))
		return { soort: 'kamerstuk', dossier: a.toUpperCase(), nummer: b.toUpperCase() };
	return null;
}

/** Whether a path is the Verkenner: /explore, or a readable address of a bron. */
export const isVerkenner = (pathname: string) =>
	pathname === '/explore' || parsePad(pathname) !== null;

/** The path of a readable address. */
export function padHref(pad: Pad): string {
	const e = encodeURIComponent;
	// A colon is safe in a path segment, and reads better than %3A.
	const keep = (s: string) => e(s).replaceAll('%3A', ':');
	switch (pad.soort) {
		case 'uitspraak':
			return `/uitspraken/${keep(pad.ecli)}`;
		case 'artikel':
			return `/wetten/${e(pad.wet)}/artikel/${keep(pad.nummer)}`;
		case 'dossier':
			return `/dossiers/${e(pad.nummer)}`;
		case 'kamerstuk':
			return `/kamerstukken/${e(pad.dossier)}/${e(pad.nummer)}`;
		case 'publicatie':
			return `/${pad.reeks}/${pad.jaar}/${pad.nummer}`;
	}
}

/** A judgment's node key from its ECLI, and back: `ecli_nl_hr_2019_2006`. */
const ecliKey = (ecli: string) => ecli.toLowerCase().replaceAll(':', '_');
const keyEcli = (key: string) =>
	/^ecli_[a-z]{2}_[a-z0-9]+_\d{4}_[a-z0-9.]+$/.test(key)
		? key.toUpperCase().replaceAll('_', ':')
		: null;

// What was looked up, both ways: an address and the focus it names. Filled by the
// lookups below and by `remember`, so a second visit, and the link to a bron already
// seen, need no request.
const focusVan = new SvelteMap<string, string>();
const padVan = new SvelteMap<string, string>();

/** Keep an address and its focus together. */
export function remember(path: string, focus: string) {
	focusVan.set(path, focus);
	padVan.set(focus, path);
}

/** The focus an address names without a request: a judgment and a dossier, or one seen. */
export function focusOfPad(pad: Pad): string | null {
	if (pad.soort === 'uitspraak') return `judgments/${ecliKey(pad.ecli)}`;
	if (pad.soort === 'dossier') return `dossiers/${pad.nummer}`;
	return focusVan.get(padHref(pad)) ?? null;
}

/** What /api/lookup is asked for an address: its kind and exact parameters. */
function lookupQuery(pad: Pad) {
	switch (pad.soort) {
		case 'uitspraak':
			return { kind: 'judgment', ecli: pad.ecli } as const;
		case 'artikel':
			return { kind: 'article', law: pad.wet, number: pad.nummer } as const;
		case 'dossier':
			return { kind: 'dossier', number: pad.nummer } as const;
		case 'kamerstuk':
			return { kind: 'document', dossier: pad.dossier, number: pad.nummer } as const;
		case 'publicatie':
			return {
				kind: 'publication',
				series: pad.reeks,
				year: pad.jaar,
				number: pad.nummer
			} as const;
	}
}

/**
 * The focus of an address that needs the API, by /api/lookup: exact or nothing. A
 * Kamerstuk that is not in the data does not open its dossier instead. Null when the
 * data lacks it (404 `not_in_data`); another failure is thrown, to be said as such.
 */
export async function lookUp(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const known = focusOfPad(pad);
	if (known) return known;
	const { data, response } = await api.GET('/api/lookup', {
		params: { query: lookupQuery(pad) },
		signal
	});
	if (response.status === 404) return null;
	if (!data) throw new Error(`lookup ${response.status}`);
	const focus = `${data.collection}/${data.key}`;
	remember(padHref(pad), focus);
	return focus;
}

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * The readable address of a focus, from its key or from the props of its node; null
 * where it has none (a lid, a stemming, a stuk of the Eerste Kamer: still /explore).
 */
export function padOfFocus(focus: string, props?: Record<string, unknown> | null): string | null {
	const seen = padVan.get(focus);
	if (seen) return seen;
	const target = parseNodeId(focus);
	if (!target) return null;
	switch (target.collection) {
		case 'judgments': {
			const ecli = text(props?.ecli) ?? keyEcli(target.key);
			return ecli && ECLI.test(ecli)
				? padHref({ soort: 'uitspraak', ecli: ecli.toUpperCase() })
				: null;
		}
		case 'dossiers':
			return DOSSIER.test(target.key) ? padHref({ soort: 'dossier', nummer: target.key }) : null;
		case 'articles': {
			const wet = text(props?.bwb_id) ?? text(props?.celex);
			const nummer = text(props?.article_number);
			// A number with a space ("bijlage 2 artikel 6") has no address of its own.
			if (!wet || !nummer || /\s/.test(nummer)) return null;
			return padHref({ soort: 'artikel', wet, nummer: bookNumber(wet, nummer) });
		}
		case 'instruments': {
			// A publication by its id at officielebekendmakingen.nl (stb-2026-94), or its key.
			const id = text(props?.official_id) ?? target.key.replaceAll('_', '-');
			const m = /^(stb|stcrt|trb)-(\d{4})-(\d+)$/.exec(id.toLowerCase());
			return m
				? padHref({ soort: 'publicatie', reeks: m[1] as Reeks, jaar: m[2], nummer: m[3] })
				: null;
		}
		case 'documents': {
			// Dossier and number as the stuk is cited: 36600-VIII, and 31 in the Tweede
			// Kamer or AB in the Eerste (`number`, the letter).
			const number = text(props?.dossier_number);
			const suffix = text(props?.dossier_suffix);
			const dossier = number && suffix ? `${number}-${suffix}` : number;
			const nummer =
				typeof props?.sequence === 'number' ? String(props.sequence) : text(props?.number);
			if (!dossier || !nummer || !STUK.test(nummer)) return null;
			return padHref({ soort: 'kamerstuk', dossier, nummer: nummer.toUpperCase() });
		}
	}
	return null;
}

/**
 * The URL as the Verkenner reads it: `/explore` with the focus in the query. An
 * address whose focus is not known yet reads without one, until `lookUp` finds it.
 */
export function verkennerUrl(url: URL): URL {
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
export const focusIn = (url: URL) => verkennerUrl(url).searchParams.get('focus');

/**
 * The address of a view of the Verkenner: the readable path of its focus where it has
 * one, the rest in the query. `params` is the query as the Verkenner reads it.
 */
export function verkennerHref(
	params: URLSearchParams,
	hash = '',
	props?: Record<string, unknown> | null
): string {
	const focus = params.get('focus');
	const path = focus ? padOfFocus(focus, props) : null;
	const rest = new URLSearchParams(params);
	if (path) rest.delete('focus');
	// A node id is safe in a query string as it is; the escaped slash only hurts legibility.
	const query = rest.toString().replaceAll('%2F', '/').replaceAll('%2C', ',');
	return `${path ?? '/explore'}${query ? `?${query}` : ''}${hash}`;
}
