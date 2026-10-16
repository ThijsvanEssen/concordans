// A source pasted into a map that Concordans holds: an address of Concordans itself, or of
// the official source it reads (rechtspraak.nl, wetten.overheid.nl, officielebekendmakingen.nl,
// EUR-Lex), or an ECLI in the citation. Read from the text alone, in the browser: nothing is
// fetched. The map proposes the bron's reader; it never makes the item on its own.
import { padHref, parsePad } from '$lib/bron/address';
import { kamerstukNummer } from '$lib/bron/dossier-naam';

const ECLI = /\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]*[A-Z0-9]/i;
const BWB = /\bBWBR\d{7}\b/i;
const CELEX = /CELEX(?::|%3A|=)\s*(\d{5}[A-Z]{1,2}\d{4})/i;
/** A Kamerstuk at officielebekendmakingen.nl: `kst-36600-VIII-14`, `kst-36799-31`. */
const KST = /\bkst-(\d+(?:-[a-z]+)?)-(\w+?)(?=\.html|[?#/]|$)/i;
/** A publication there: `stb-2026-94`. */
const PUBLICATION = /\b(stb|stcrt|trb)-(\d{4})-(\d+)\b/i;
/** The hosts of Concordans. */
const OWN_HOSTS = /^(?:www\.)?concordans\.nl$|^localhost$|^127\.0\.0\.1$/;
const SERIES: Record<string, string> = { stb: 'Stb.', stcrt: 'Stcrt.', trb: 'Trb.' };

/** How a proposal names a bron by its readable address. */
function labelOf(path: string): string {
	const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
	const [kind, first, second, third] = parts;
	if (kind === 'uitspraken') return first.toUpperCase();
	if (kind === 'wetten' && second === 'artikel') return `art. ${third}, ${first.toUpperCase()}`;
	if (kind === 'wetten' && parts.length === 2) return first.toUpperCase();
	if (kind === 'kamerstukken') return `${kamerstukNummer(first)}, nr. ${second}`;
	if (kind in SERIES) return `${SERIES[kind]} ${first}, ${second}`;
	return path;
}

/**
 * The bron of Concordans at a path: its readable address, how the proposal names it, and for
 * a law or an article its law's id and the article's number, so the form names them as the
 * reader does once the law's name is known.
 */
function found(
	path: string
): { path: string; label: string; law?: string; article?: string } | null {
	const parsed = parsePad(path);
	if (!parsed) return null;
	const href = padHref(parsed);
	const [kind, law, part, article] = href.split('/').filter(Boolean).map(decodeURIComponent);
	return {
		path: href,
		label: labelOf(href),
		...(kind === 'wetten' && (!part || part === 'artikel') ? { law: law.toUpperCase() } : {}),
		...(kind === 'wetten' && part === 'artikel' ? { article } : {})
	};
}

/** The path of Concordans in a URL of its own; null for any other. */
function ownPath(text: string, origin?: string): string | null {
	try {
		const url = new URL(text.trim());
		return OWN_HOSTS.test(url.hostname) || url.origin === origin ? url.pathname : null;
	} catch {
		return null;
	}
}

/** The path in Concordans a pasted address or citation names; null where it names none. */
function pathOf(text: string, origin?: string): string | null {
	const own = ownPath(text, origin);
	if (own) return own;
	const ecli = ECLI.exec(text)?.[0];
	if (ecli) return `/uitspraken/${ecli.toUpperCase()}`;
	const kst = KST.exec(text);
	if (kst) return `/kamerstukken/${kst[1].toUpperCase()}/${kst[2]}`;
	const publication = /officielebekendmakingen/i.test(text) ? PUBLICATION.exec(text) : null;
	if (publication) return `/${publication[1].toLowerCase()}/${publication[2]}/${publication[3]}`;
	const law = BWB.exec(text)?.[0] ?? CELEX.exec(text)?.[1];
	return law ? `/wetten/${law.toUpperCase()}` : null;
}

/** The bron of Concordans a pasted address or citation names; null where it names none. */
export function recognize(text: string, origin?: string) {
	const path = text.trim() ? pathOf(text, origin) : null;
	return path ? found(path) : null;
}
