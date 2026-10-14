// The API's word rule, and the mark that shows where a row was found: $lib/text/treffer.
import { isDay } from '$lib/text/datum';
import { normaal, woordIn } from '$lib/text/treffer';
export { normaal, woordIn };

// A topic followed: the words of the user, looked for in the titles of Actueel. The source has
// no theme of its own (the TK OData has none, Back-end #3, 9 Oct), so a topic is its words.
// Or a law, or an article of one: what Actueel ties to it (`instrument`, API 0.79.55).
// Kept in this browser only; an address carries the same topics to someone else.

/** A law followed, or one of its articles. */
export type GevolgdeWet = { bwb: string; titel: string; artikel?: string | null };

export type Onderwerp = {
	/** The words, each looked for apart: `kunstmatige intelligentie`, `AI`. Of a law its name. */
	termen: string[];
	/** A law or article followed instead of words. */
	wet?: GevolgdeWet;
	/** The day the data reached at the visit before this one: new is from there on. */
	vorige: string | null;
	/** The day the data reached at this visit. */
	gezien: string | null;
};

const SLEUTEL = 'concordans:onderwerpen';
/** Set once a browser session: a reload in the same session keeps what was new. */
const SESSIE = 'concordans:onderwerpen-bezocht';

const gelijk = (a: string, b: string) => normaal(a).toLowerCase() === normaal(b).toLowerCase();

/** The topic is the same if one of its words is; a law's name is not a word followed. */
export const vindIndex = (lijst: Onderwerp[], term: string) =>
	lijst.findIndex((o) => !o.wet && o.termen.some((t) => gelijk(t, term)));

/** `artikel 3 Cyberbeveiligingswet`, `Cyberbeveiligingswet`: a law followed by its name. */
export const wetNaam = (w: GevolgdeWet) =>
	w.artikel ? `artikel ${w.artikel} ${w.titel}` : w.titel;

/** A topic by what it follows: its words, or its law and article. */
export const sleutelVan = (o: Pick<Onderwerp, 'termen' | 'wet'>) =>
	o.wet
		? `wet:${o.wet.bwb.toUpperCase()}${o.wet.artikel ? `:${o.wet.artikel}` : ''}`
		: o.termen.join('|').toLowerCase();

const wetSleutel = (w: GevolgdeWet) => sleutelVan({ termen: [], wet: w });

/** Where the list follows this law or article; -1 where it does not. */
export const wetIndex = (lijst: Onderwerp[], w: GevolgdeWet) =>
	lijst.findIndex((o) => o.wet && sleutelVan(o) === wetSleutel(w));

const leesWet = (v: unknown): GevolgdeWet | null => {
	if (!v || typeof v !== 'object') return null;
	const { bwb, titel, artikel } = v as Record<string, unknown>;
	if (typeof bwb !== 'string' || !/^BWBR\d+$/i.test(bwb)) return null;
	return {
		bwb: bwb.toUpperCase(),
		titel: typeof titel === 'string' && titel.trim() ? titel.trim() : bwb.toUpperCase(),
		artikel: typeof artikel === 'string' && artikel.trim() ? artikel.trim() : null
	};
};

export function lees(): Onderwerp[] {
	try {
		const raw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '[]');
		if (!Array.isArray(raw)) return [];
		return raw.flatMap((o) => {
			const dag = (v: unknown) => (typeof v === 'string' && isDay(v) ? v : null);
			const wet = leesWet(o?.wet);
			if (wet)
				return [{ termen: [wetNaam(wet)], wet, vorige: dag(o.vorige), gezien: dag(o.gezien) }];
			const termen = Array.isArray(o?.termen)
				? o.termen.filter((t: unknown): t is string => typeof t === 'string' && !!normaal(t))
				: [];
			if (!termen.length) return [];
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

/** Whether this browser follows the law or article. */
export const volgtWet = (w: GevolgdeWet) => wetIndex(lees(), w) >= 0;

/** Follow a law, or an article of it. */
export function volgWet(w: GevolgdeWet) {
	const lijst = lees();
	if (wetIndex(lijst, w) >= 0) return;
	const wet = { bwb: w.bwb.toUpperCase(), titel: w.titel, artikel: w.artikel ?? null };
	bewaar([...lijst, { termen: [wetNaam(wet)], wet, vorige: null, gezien: null }]);
}

/** Stop following a topic, of words or of a law. */
export function ontvolgOnderwerp(o: Pick<Onderwerp, 'termen' | 'wet'>) {
	const k = sleutelVan(o);
	bewaar(lees().filter((x) => sleutelVan(x) !== k));
}

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

/** The day the data reached, kept per topic for the next visit: by a word of it, or itself. */
export function zetGezien(term: string | Pick<Onderwerp, 'termen' | 'wet'>, dag: string) {
	const lijst = lees();
	const i =
		typeof term === 'string'
			? vindIndex(lijst, term)
			: lijst.findIndex((o) => sleutelVan(o) === sleutelVan(term));
	if (i < 0 || (lijst[i].gezien && lijst[i].gezien >= dag)) return;
	lijst[i] = { ...lijst[i], gezien: dag };
	bewaar(lijst);
}

/** A topic shows at least this many days, new or not. */
export const RECENT_DAGEN = 30;

/**
 * From which day a topic is shown: the recent days, or from the visit before when that lies
 * further back. Only what is new would leave a topic visited today empty (Thijs, 9 Oct).
 */
export const vensterVan = (vorige: string | null, recent: string) =>
	vorige && vorige < recent ? vorige : recent;

/** New: after the day the data had reached at the visit before. */
export const isNieuw = (datum: string, vorige: string | null) => !!vorige && datum > vorige;

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

export function deelAdres(lijst: Pick<Onderwerp, 'termen' | 'wet'>[]): string {
	const p = new URLSearchParams();
	for (const o of lijst)
		if (o.wet) p.append('wet', naarWetParam(o.wet));
		else p.append('onderwerp', naarParam(o.termen));
	return `/onderwerpen?${p}`;
}

// `?wet=BWBR0052872` a law, `?wet=BWBR0052872/3` an article of it (a number may hold a `:`).
export const naarWetParam = (w: GevolgdeWet) =>
	`${w.bwb.toUpperCase()}${w.artikel ? `/${w.artikel}` : ''}`;

/** The laws of an address; their names come with their first answer (`titel` the id). */
export function wettenUitParams(params: URLSearchParams): GevolgdeWet[] {
	return params.getAll('wet').flatMap((v) => {
		const [bwb, ...rest] = v.trim().split('/');
		const w = leesWet({ bwb, artikel: rest.join('/') });
		return w ? [w] : [];
	});
}
