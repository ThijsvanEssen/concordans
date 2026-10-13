// The delegation formulas of an article ("bij of krachtens algemene maatregel van bestuur",
// "bij ministeriële regeling") and the regulations issued under them (Thijs, 12 Oct: at such
// a formula the AMvB's on that grondslag, or that there are none yet). The API marks each
// formula (`delegations`) and names per formula the regulations that fill it
// (`.../delegated`, `clauses`); nothing is read from the text here.
import type { Schema } from '$lib/api/types';
import { kindName } from '$lib/components/explore/law-head';
import { langeDatum } from '$lib/text/datum';
import { naamVan } from '$lib/bron/menselijk';
import { bookNumber } from '$lib/text/bw';

export type Delegatie = Schema<'DelegationClauseDTO'>;
export type Gedelegeerd = Schema<'ArticleDelegatedResponse'>;
export type Regeling = Schema<'DelegatedRegulationDTO'>;

/** A formula inside a part's text: offsets relative to that text, `bij` its offset in the
 *  article's text (where the API's `clauses` name it). */
export type DelegatieSpan = Delegatie & { bij: number };

/** The formulas inside text[from, from + length), with offsets relative to `from`. */
export function delegatiesWithin(
	spans: readonly Delegatie[],
	from: number,
	length: number
): DelegatieSpan[] {
	return spans
		.filter((s) => s.start >= from && s.end <= from + length)
		.map((s) => ({ ...s, bij: s.start, start: s.start - from, end: s.end - from }));
}

/** The regulations that fill the formula at `bij` in the article's text, in the API's order;
 *  null when the answer names no such formula. */
export function vullingVan(gedelegeerd: Gedelegeerd, bij: number): Regeling[] | null {
	const clause = (gedelegeerd.clauses ?? []).find((c) => c.start === bij);
	if (!clause) return null;
	const keys = new Set(clause.instruments ?? []);
	return (gedelegeerd.items ?? []).filter((i) => keys.has(i.instrument.key));
}

/** What the formula asks for, where none is issued yet. */
export const nogGeen = (d: Pick<Delegatie, 'kind'>): string =>
	d.kind === 'amvb'
		? 'Nog geen AMvB op deze grondslag'
		: 'Nog geen ministeriële regeling op deze grondslag';

/** The kicker of the formula's card: `Grondslag, lid 1`. */
export const grondslagKop = (d: Pick<Delegatie, 'lid'>): string =>
	d.lid ? `Grondslag, lid ${d.lid}` : 'Grondslag';

/** The regulation's name: its citation title, else as every bron is named. */
export const regelingNaam = (r: Regeling): string =>
	r.instrument.citation_title ?? naamVan('instruments', r.instrument);

/** The line under it: its kind and when it took effect, `AMvB, 15 augustus 2026`. */
export const regelingRegel = (r: Regeling): string | null =>
	[kindName(r.kind), langeDatum(r.date_in_force)].filter(Boolean).join(', ') || null;

/** An article of the regulation that refers here, as the card names it: `art. 2`. */
export const artikelKort = (a: Schema<'DelegatedArticleDTO'>): string =>
	a.article_number ? `art. ${a.article_number}` : naamVan('articles', a);

/** A regulation issued under a law, with the articles of the law its `Gelet op` names. */
export type WetRegeling = Schema<'InstrumentDelegatedItem'>;

/** `1 en 7`, `1, 2 en 3`: numbers as a list is read. */
const opsomming = (xs: readonly string[]) =>
	xs.length > 1 ? `${xs.slice(0, -1).join(', ')} en ${xs.at(-1)}` : (xs[0] ?? '');

/** The leden a Gelet op names, `lid 1 en 7`; null where it names the article whole. */
export function ledenTekst(leden: unknown): string | null {
	const xs = Array.isArray(leden)
		? leden.filter((l): l is string => typeof l === 'string' && !!l.trim())
		: [];
	return xs.length ? `lid ${opsomming(xs)}` : null;
}

/**
 * The articles of the law a regulation rests on, once each, in the law's order, with the
 * leden and onderdelen its Gelet op names: `art. 3, 16 lid 1 en 7, 17 lid 1`; a BW article
 * with its book, `art. 7:719` (`bwb` the law's id). An article the Gelet op names twice
 * stands once, with the leden of both. Null where it names none by number.
 */
export function grondslagArtikelen(
	articles: readonly Schema<'BasisArticleDTO'>[],
	bwb?: string | null
): string | null {
	const per = new Map<string, { leden: Set<string>; onderdelen: Set<string>; heel: boolean }>();
	for (const a of articles) {
		const nr = a.article_number?.trim();
		if (!nr) continue;
		const deel = per.get(nr) ?? { leden: new Set(), onderdelen: new Set(), heel: false };
		// Named once whole and once by a lid: the whole article.
		if (!a.leden?.length) deel.heel = true;
		// A lid that is the article's own number is the API reading "673e" as a lid (BW 7:673e).
		const stam = nr.replace(/\D+$/, '');
		for (const l of a.leden ?? []) if (l !== stam && l !== nr) deel.leden.add(l);
		for (const o of a.onderdelen ?? []) deel.onderdelen.add(o);
		per.set(nr, deel);
	}
	const delen = [...per].map(([nr, d]) => {
		const leden = d.heel ? null : ledenTekst([...d.leden]);
		const onder = !d.heel && d.onderdelen.size ? `onder ${opsomming([...d.onderdelen])}` : null;
		return [bookNumber(bwb, nr), leden, onder].filter(Boolean).join(' ');
	});
	return delen.length ? `art. ${delen.join(', ')}` : null;
}

/**
 * The verb of a regulation under its grondslag, by its kind: `AMvB op grond van`,
 * `Ministeriële regeling op grond van`; `Op grond van` where the kind is unknown. One
 * function for the law's page and the article's (and a map), so they say it alike.
 */
export function grondslagWerkwoord(kind: string | null | undefined): string {
	const soort = kindName(kind);
	return soort ? `${soort} op grond van` : 'Op grond van';
}
