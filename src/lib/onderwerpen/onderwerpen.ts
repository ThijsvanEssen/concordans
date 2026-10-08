// A topic followed: the words of the user, looked for in the titles of Actueel. The source has
// no theme of its own (the TK OData has none, Back-end #3, 9 Oct), so a topic is its words.
// Kept in this browser only; an address carries the same topics to someone else.

export type Onderwerp = {
	/** The words, each looked for apart: `kunstmatige intelligentie`, `AI`. */
	termen: string[];
	/** The day the data reached at the visit before this one: new is from there on. */
	vorige: string | null;
	/** The day the data reached at this visit. */
	gezien: string | null;
};

const SLEUTEL = 'concordans:onderwerpen';
/** Set once a browser session: a reload in the same session keeps what was new. */
const SESSIE = 'concordans:onderwerpen-bezocht';

export const normaal = (term: string) => term.trim().replace(/\s+/g, ' ');
const gelijk = (a: string, b: string) => normaal(a).toLowerCase() === normaal(b).toLowerCase();

/** The topic is the same if one of its words is. */
export const vindIndex = (lijst: Onderwerp[], term: string) =>
	lijst.findIndex((o) => o.termen.some((t) => gelijk(t, term)));

export function lees(): Onderwerp[] {
	try {
		const raw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '[]');
		if (!Array.isArray(raw)) return [];
		return raw.flatMap((o) => {
			const termen = Array.isArray(o?.termen)
				? o.termen.filter((t: unknown): t is string => typeof t === 'string' && !!normaal(t))
				: [];
			if (!termen.length) return [];
			const dag = (v: unknown) =>
				typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
			return [{ termen, vorige: dag(o.vorige), gezien: dag(o.gezien) }];
		});
	} catch {
		return [];
	}
}

export function bewaar(lijst: Onderwerp[]) {
	try {
		if (lijst.length) localStorage.setItem(SLEUTEL, JSON.stringify(lijst));
		else localStorage.removeItem(SLEUTEL);
	} catch {
		/* geen opslag */
	}
}

export const volgt = (term: string) => !!normaal(term) && vindIndex(lees(), term) >= 0;

/** The words once each, whatever their capitals, in the order given. */
export function uniek(termen: string[]): string[] {
	const gezien = new Set<string>();
	return termen.map(normaal).filter((t) => {
		const k = t.toLowerCase();
		if (!t || gezien.has(k)) return false;
		gezien.add(k);
		return true;
	});
}

/** `AI; kunstmatige intelligentie, artificial intelligence`: words apart by `;` or `,`. */
export const splitsTermen = (invoer: string) => uniek(invoer.split(/[;,]/));

export function volg(termen: string[]) {
	const schoon = uniek(termen);
	if (!schoon.length) return;
	const lijst = lees();
	if (schoon.some((t) => vindIndex(lijst, t) >= 0)) return;
	bewaar([...lijst, { termen: schoon, vorige: null, gezien: null }]);
}

export function ontvolg(term: string) {
	const lijst = lees();
	const i = vindIndex(lijst, term);
	if (i >= 0) bewaar(lijst.filter((_, j) => j !== i));
}

/** More words for the topic `term` is in; a word another topic has stays there. */
export function voegTermenToe(term: string, nieuw: string[]) {
	const lijst = lees();
	const i = vindIndex(lijst, term);
	if (i < 0) return;
	const erbij = uniek(nieuw).filter((t) => vindIndex(lijst, t) < 0);
	if (!erbij.length) return;
	lijst[i] = { ...lijst[i], termen: [...lijst[i].termen, ...erbij] };
	bewaar(lijst);
}

/** One word less; the last word of a topic stays, as dropping it is `ontvolg`. */
export function haalTermWeg(term: string) {
	const lijst = lees();
	const i = vindIndex(lijst, term);
	if (i < 0 || lijst[i].termen.length < 2) return;
	lijst[i] = { ...lijst[i], termen: lijst[i].termen.filter((t) => !gelijk(t, term)) };
	bewaar(lijst);
}

/**
 * A new visit: what the data reached last time becomes the day new counts from. Once a
 * browser session, or a reload would empty the list it shows.
 */
export function nieuwBezoek(lijst: Onderwerp[]): Onderwerp[] {
	try {
		if (sessionStorage.getItem(SESSIE)) return lijst;
		sessionStorage.setItem(SESSIE, '1');
	} catch {
		return lijst;
	}
	const volgende = lijst.map((o) => ({ ...o, vorige: o.gezien ?? o.vorige }));
	bewaar(volgende);
	return volgende;
}

/** The day the data reached, kept per topic for the next visit. */
export function zetGezien(term: string, dag: string) {
	const lijst = lees();
	const i = vindIndex(lijst, term);
	if (i < 0 || (lijst[i].gezien && lijst[i].gezien >= dag)) return;
	lijst[i] = { ...lijst[i], gezien: dag };
	bewaar(lijst);
}

// ── The address ────────────────────────────────────────────────────────────
// `?onderwerp=kunstmatige intelligentie|AI&onderwerp=stikstof`: one parameter per topic, its
// words apart by `|`, which a title rarely holds.

export const naarParam = (termen: string[]) => termen.map(normaal).join('|');

export function uitParams(params: URLSearchParams): string[][] {
	return (
		params
			.getAll('onderwerp')
			// `|` since 9 Oct; `;` as typed works too.
			.map((v) => uniek(v.split(/[|;]/)))
			.filter((t) => t.length)
	);
}

export function deelAdres(lijst: Pick<Onderwerp, 'termen'>[]): string {
	const p = new URLSearchParams();
	for (const o of lijst) p.append('onderwerp', naarParam(o.termen));
	return `/onderwerpen?${p}`;
}

// ── Matching ───────────────────────────────────────────────────────────────

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Up to this length a word is an abbreviation (`AI`, `PFAS`): it has to stand whole. */
const KORT = 4;

/**
 * The API matches any part of a title: `AI` is in `universitaire`. Here a word has to start
 * where a word starts, so `algoritme` finds `algoritmes`; a short one has to end there too,
 * so `AI` finds `AI-modellen` and not `AIV-advies`.
 */
export function woordIn(term: string, tekst: string | null | undefined): boolean {
	if (!tekst) return false;
	const woord = normaal(term);
	const eind = woord.length <= KORT ? '(?![\\p{L}\\p{N}])' : '';
	return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(woord)}${eind}`, 'iu').test(tekst);
}
