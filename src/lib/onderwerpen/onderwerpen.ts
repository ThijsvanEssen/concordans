// The API's word rule, and the mark that shows where a row was found: $lib/text/treffer.
import { articleRef } from '$lib/text/bw';
import { textOf } from '$lib/text/words';
import { isDay } from '$lib/text/datum';
import { normaal } from '$lib/text/treffer';
import { isFeedLaw } from '$lib/components/actueel/filters';
import { dossierLabel } from '$lib/bron/dossier-naam';

// A topic followed: the words of the user, looked for in the titles of Actueel. The source has
// no theme of its own (the TK OData has none, Back-end #3, 9 Oct), so a topic is its words.
// Or a law, or an article of one: what Actueel ties to it (`instrument`, API 0.79.55). Or a
// dossier, followed from its page: what Actueel holds of it (`dossier`), `gezien` the day of
// the visit before (API 0.80.1, #866).
// Kept in this browser only; an address carries the same topics to someone else.

/** A law followed, or one of its articles. */
export type GevolgdeWet = { bwb: string; titel: string; artikel?: string | null };

/** A dossier followed: its number as the Kamer writes it (`36600-VII`) and its name. */
export type FollowedDossier = { number: string; title: string };

export type Onderwerp = {
	/** The words, each looked for apart: `kunstmatige intelligentie`, `AI`. Of a law its name. */
	termen: string[];
	/** A law or article followed instead of words. */
	wet?: GevolgdeWet;
	/** A dossier followed instead of words. */
	dossier?: FollowedDossier;
	/** The day the data reached at the visit before this one: new is from there on. */
	vorige: string | null;
	/** The day the data reached at this visit. */
	gezien: string | null;
};

const SLEUTEL = 'concordans:onderwerpen';
/** Set once a browser session: a reload in the same session keeps what was new. */
const SESSIE = 'concordans:onderwerpen-bezocht';

const gelijk = (a: string, b: string) => normaal(a).toLowerCase() === normaal(b).toLowerCase();

/** A topic of words, not a law or a dossier followed. */
export const isWords = (o: Pick<Onderwerp, 'wet' | 'dossier'>) => !o.wet && !o.dossier;

/** The topic is the same if one of its words is; a law's name is not a word followed. */
export const vindIndex = (lijst: Onderwerp[], term: string) =>
	lijst.findIndex((o) => isWords(o) && o.termen.some((t) => gelijk(t, term)));

/** `artikel 3 Cyberbeveiligingswet`, `Cyberbeveiligingswet`: a law followed by its name. */
export const wetNaam = (w: GevolgdeWet) =>
	w.artikel ? `${articleRef(null, w.artikel, { form: 'artikel' })} ${w.titel}` : w.titel;

/**
 * A topic by what it follows: its law and article, or its words, lowercase and sorted, so
 * `Huur; huurtoeslag` and `huurtoeslag;Huur` are one topic, with one coding (strekking).
 */
export const topicKey = (
	o: Pick<Onderwerp, 'termen'> & Partial<Pick<Onderwerp, 'wet' | 'dossier'>>
) =>
	o.dossier
		? `dossier:${o.dossier.number.toUpperCase()}`
		: o.wet
			? `wet:${o.wet.bwb.toUpperCase()}${o.wet.artikel ? `:${o.wet.artikel}` : ''}`
			: [...new Set(o.termen.map((t) => normaal(t).toLowerCase()).filter(Boolean))]
					.sort()
					.join('|');

const wetSleutel = (w: GevolgdeWet) => topicKey({ termen: [], wet: w });

/** Where the list follows this law or article; -1 where it does not. */
const wetIndex = (lijst: Onderwerp[], w: GevolgdeWet) =>
	lijst.findIndex((o) => o.wet && topicKey(o) === wetSleutel(w));

const leesWet = (v: unknown): GevolgdeWet | null => {
	if (!v || typeof v !== 'object') return null;
	const { bwb, titel, artikel } = v as Record<string, unknown>;
	if (typeof bwb !== 'string' || !isFeedLaw(bwb)) return null;
	return {
		bwb: bwb.toUpperCase(),
		titel: textOf(titel) ?? bwb.toUpperCase(),
		artikel: textOf(artikel)
	};
};

/** A dossier number as the API takes it: `36764`, `36600-VII`, `23908-(R1519)`. */
const DOSSIER = /^\d+(-[A-Za-z0-9()]+)?$/;

const readDossier = (v: unknown): FollowedDossier | null => {
	if (!v || typeof v !== 'object') return null;
	const { number, title } = v as Record<string, unknown>;
	if (typeof number !== 'string' || !DOSSIER.test(number.trim())) return null;
	return { number: number.trim(), title: textOf(title) ?? number.trim() };
};

/** `Kamerstuk 36764 Cyberbeveiligingswet`: a dossier followed by its number and name. */
export const followedDossierName = (d: FollowedDossier) =>
	dossierLabel({ number: d.number, title: d.title === d.number ? null : d.title });

export function lees(): Onderwerp[] {
	try {
		const raw = JSON.parse(localStorage.getItem(SLEUTEL) ?? '[]');
		if (!Array.isArray(raw)) return [];
		return raw.flatMap((o) => {
			const dag = (v: unknown) => (typeof v === 'string' && isDay(v) ? v : null);
			const dossier = readDossier(o?.dossier);
			if (dossier)
				return [
					{
						termen: [followedDossierName(dossier)],
						dossier,
						vorige: dag(o.vorige),
						gezien: dag(o.gezien)
					}
				];
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

const indexOfDossier = (list: Onderwerp[], number: string) =>
	list.findIndex(
		(o) => o.dossier && topicKey(o) === topicKey({ termen: [], dossier: { number, title: '' } })
	);

/** Whether this browser follows the dossier. */
export const followsDossier = (number: string) => indexOfDossier(lees(), number) >= 0;

/** Follow a dossier; from today on, what comes in is new. */
export function followDossier(d: FollowedDossier, today: string) {
	const list = lees();
	if (indexOfDossier(list, d.number) >= 0) return;
	const dossier = { number: d.number, title: d.title };
	bewaar([
		...list,
		{ termen: [followedDossierName(dossier)], dossier, vorige: null, gezien: today }
	]);
}

/**
 * A visit to a followed dossier's page: the day of the visit before, and from now on today.
 * Null for a dossier not followed, or never seen.
 */
export function visitDossier(number: string, today: string): string | null {
	const list = lees();
	const i = indexOfDossier(list, number);
	if (i < 0) return null;
	const before = list[i].gezien;
	if (!before || before < today) {
		list[i] = { ...list[i], gezien: today };
		bewaar(list);
	}
	return before;
}

/** Stop following a topic, of words, of a law or of a dossier. */
export function ontvolgOnderwerp(o: Pick<Onderwerp, 'termen' | 'wet' | 'dossier'>) {
	const k = topicKey(o);
	bewaar(lees().filter((x) => topicKey(x) !== k));
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

/** One word less; the last word of a topic stays, as dropping it is `ontvolgOnderwerp`. */
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
export function zetGezien(
	term: string | Pick<Onderwerp, 'termen' | 'wet' | 'dossier'>,
	dag: string
) {
	const lijst = lees();
	const i =
		typeof term === 'string'
			? vindIndex(lijst, term)
			: lijst.findIndex((o) => topicKey(o) === topicKey(term));
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
// `#onderwerp=kunstmatige intelligentie|AI&onderwerp=stikstof`: one parameter per topic, its
// words apart by `|`, which a title rarely holds. In the fragment, as a bundel's link has
// its bundel (`#m=`): the browser does not send it, so the words stay out of the server's
// log (B19). A link of before, with them in the query, opens the same.

export const topicParam = (termen: string[]) => termen.map(normaal).join('|');

/** Each topic once, by its key: an address may hold one in two orders (#134). */
const onceEach = <T>(list: T[], keyOf: (x: T) => string): T[] => {
	const seen = new Set<string>();
	return list.filter((x) => !seen.has(keyOf(x)) && !!seen.add(keyOf(x)));
};

export function topicsOf(params: URLSearchParams): string[][] {
	const topics = params
		.getAll('onderwerp')
		.map((v) => uniek(v.split('|')))
		.filter((t) => t.length);
	return onceEach(topics, (termen) => topicKey({ termen }));
}

export function deelAdres(lijst: Pick<Onderwerp, 'termen' | 'wet' | 'dossier'>[]): string {
	const p = new URLSearchParams();
	for (const o of lijst)
		if (o.dossier) p.append('dossier', o.dossier.number);
		else if (o.wet) p.append('wet', naarWetParam(o.wet));
		else p.append('onderwerp', topicParam(o.termen));
	return `/onderwerpen#${p}`;
}

/** The topics an address shares: in its fragment, or in its query (a link of before). */
export function gedeeldeParams(url: URL): URLSearchParams {
	const p = new URLSearchParams(url.search);
	for (const [k, v] of new URLSearchParams(url.hash.slice(1))) p.append(k, v);
	return p;
}

// `?wet=BWBR0052872` a law, `?wet=BWBR0052872/3` an article of it (a number may hold a `:`).
const naarWetParam = (w: GevolgdeWet) =>
	`${w.bwb.toUpperCase()}${w.artikel ? `/${w.artikel}` : ''}`;

/** The laws of an address; their names come with their first answer (`titel` the id). */
export function wettenUitParams(params: URLSearchParams): GevolgdeWet[] {
	const laws = params.getAll('wet').flatMap((v) => {
		const [bwb, ...rest] = v.trim().split('/');
		const w = leesWet({ bwb, artikel: rest.join('/') });
		return w ? [w] : [];
	});
	return onceEach(laws, wetSleutel);
}

/** The dossiers of an address (`?dossier=36764`); their names come with their first answer. */
export function dossiersFromParams(params: URLSearchParams): FollowedDossier[] {
	const dossiers = params.getAll('dossier').flatMap((v) => {
		const d = readDossier({ number: v });
		return d ? [d] : [];
	});
	return onceEach(dossiers, (d) => d.number.toUpperCase());
}
