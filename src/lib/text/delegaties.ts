// The delegation formulas of an article ("bij of krachtens algemene maatregel van bestuur",
// "bij ministeriële regeling") and the regulations issued under them (Thijs, 12 Oct: at such
// a formula the AMvB's on that grondslag, or that there are none yet). The API marks each
// formula (`delegations`) and names per formula the regulations that fill it
// (`.../delegated`, `clauses`); nothing is read from the text here.
import type { Schema } from '$lib/api/types';
import { kindName } from '$lib/components/explore/law-head';
import { langeDatum } from '$lib/text/datum';
import { naamVan } from '$lib/bron/menselijk';

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

/**
 * The articles of the law a regulation rests on, short and once each, in the law's order:
 * `art. 16, 21, 24` (Thijs, 13 Oct). Null where it names none by number.
 */
export function grondslagArtikelen(articles: readonly Schema<'BasisArticleDTO'>[]): string | null {
	const nummers = [
		...new Set(articles.map((a) => a.article_number?.trim()).filter((n): n is string => !!n))
	];
	return nummers.length ? `art. ${nummers.join(', ')}` : null;
}
