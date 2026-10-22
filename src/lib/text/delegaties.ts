// The delegation formulas of an article ("bij of krachtens algemene maatregel van bestuur",
// "bij ministeriële regeling") and the regulations issued under them (Thijs, 12 Oct: at such
// a formula the AMvB's on that grondslag, or that there are none yet). The API marks each
// formula (`delegations`) and names per formula the regulations that fill it
// (`.../delegated`, `clauses`); nothing is read from the text here.
import { joinAnd } from './words';
import { spansWithin } from './spans';
import type { Schema } from '$lib/api/types';
import { kindName } from '$lib/text/law-kind';
import { langeDatum } from '$lib/text/datum';
import { naamVan } from '$lib/bron/menselijk';
import { articleRef, bookNumber } from '$lib/text/bw';

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
	return spansWithin(spans, from, length).map((s) => ({ ...s, bij: s.start + from }));
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
	a.article_number ? articleRef(null, a.article_number) : naamVan('articles', a);

/** A regulation issued under a law, with the articles of the law its `Gelet op` names. */
export type WetRegeling = Schema<'InstrumentDelegatedItem'>;

/** The leden a Gelet op names, `lid 1 en 7`; null where it names the article whole. */
export function ledenTekst(leden: unknown): string | null {
	const xs = Array.isArray(leden)
		? leden.filter((l): l is string => typeof l === 'string' && !!l.trim())
		: [];
	return xs.length ? `lid ${joinAnd(xs)}` : null;
}

/** An article a preamble or a reference names, with the leden and onderdelen it names. */
type Deel = {
	article_number?: string | null;
	leden?: readonly string[] | null;
	onderdelen?: readonly string[] | null;
};

/**
 * The articles named, once each, in the order given, with the leden and onderdelen named:
 * `16 lid 1 en 7`, `44 lid 1 onder f`; a BW article with its book, `7:719` (`bwb` the law's
 * id). An article named twice stands once, with the leden of both; named once whole, it is
 * the whole article.
 */
export function artikelDelen(articles: readonly Deel[], bwb?: string | null): string[] {
	const per = new Map<string, { leden: Set<string>; onderdelen: Set<string>; heel: boolean }>();
	for (const a of articles) {
		const nr = a.article_number?.trim();
		if (!nr) continue;
		const deel = per.get(nr) ?? { leden: new Set(), onderdelen: new Set(), heel: false };
		if (!a.leden?.length) deel.heel = true;
		for (const l of a.leden ?? []) deel.leden.add(l);
		for (const o of a.onderdelen ?? []) deel.onderdelen.add(o);
		per.set(nr, deel);
	}
	return [...per].map(([nr, d]) => {
		const leden = d.heel ? null : ledenTekst([...d.leden]);
		const onder = !d.heel && d.onderdelen.size ? `onder ${joinAnd([...d.onderdelen])}` : null;
		return [bookNumber(bwb, nr), leden, onder].filter(Boolean).join(' ');
	});
}

/**
 * The articles of the law a regulation rests on: `art. 3, 16 lid 1 en 7, 17 lid 1`
 * (artikelDelen). Null where it names none by number.
 */
export function grondslagArtikelen(articles: readonly Deel[], bwb?: string | null): string | null {
	const delen = artikelDelen(articles, bwb);
	return delen.length ? `art. ${delen.join(', ')}` : null;
}

/** `delegates`, `mentioned` or unknown: whether the article gives the power or is only named. */
type BasisKind = 'delegates' | 'mentioned' | string | null | undefined;

/**
 * The verb of a regulation under its grondslag, by its kind: `AMvB op grond van`,
 * `Ministeriële regeling op grond van`; `Op grond van` where the kind is unknown. A preamble
 * that only names the article (`mentioned`): `Beleidsregel noemt in de aanhef`.
 */
export function grondslagWerkwoord(kind: string | null | undefined, basis?: BasisKind): string {
	const soort = kindName(kind);
	if (basis === 'mentioned') return soort ? `${soort} noemt in de aanhef` : 'Noemt in de aanhef';
	return soort ? `${soort} op grond van` : 'Op grond van';
}

/**
 * A grondslag between two regulations, as `related-instruments` gives it (`basis`) or as a
 * regulation under a regulation under the law (`sub_delegated`): which way it runs, the
 * articles its preamble names, of which law.
 */
export type Grondslag = {
	/**
	 * `inbound`: the other is issued under the articles (of this law); `outbound`: this
	 * regulation is issued under them (of the other); `via`: the other is issued under the
	 * articles of `wet`, a regulation issued under this law.
	 */
	richting: 'inbound' | 'outbound' | 'via';
	/** The kind of the regulation that is issued, where the line names it. */
	kind?: string | null;
	basis?: BasisKind;
	articles: readonly Deel[];
	/** The law the articles are of, for a BW article's book. */
	bwb?: string | null;
	/** Its name, where the line must say it: `via`, the head of a regulation. */
	wet?: string | null;
};

/**
 * The line of a grondslag, the one function for every place that says one (a row of
 * Verbonden, a map, the head of a regulation):
 * - inbound: `AMvB op grond van` `art. 3, 16 lid 1 en 7`;
 * - outbound: `Op grond van` `art. 7` (the row or the name after it says of which law);
 * - via: `Ministeriële regeling op grond van` `art. 19, 23, 28 Cyberbeveiligingsbesluit`.
 */
export function grondslagRegel(g: Grondslag): { werkwoord: string; rest: string | null } {
	const artikelen = grondslagArtikelen(g.articles, g.bwb);
	const rest = [artikelen, g.wet].filter(Boolean).join(' ') || null;
	const werkwoord =
		g.richting === 'outbound'
			? grondslagWerkwoord(null, g.basis)
			: grondslagWerkwoord(g.kind, g.basis);
	return { werkwoord, rest };
}

/** How many articles that work a grondslag out a line names; the rest counted. */
const UITGEWERKT_GENOEMD = 6;

/**
 * The articles of a regulation that work its grondslag out (`referring`): `uitgewerkt in
 * art. 2 en 3`. Null where none refers to it.
 */
export function uitgewerktIn(referring: unknown, bwb?: string | null): string | null {
	const xs = Array.isArray(referring)
		? artikelDelen(
				referring
					.filter((a): a is Deel => !!a && typeof a === 'object')
					.map((a) => ({ article_number: a.article_number })),
				bwb
			)
		: [];
	if (!xs.length) return null;
	const genoemd = xs.slice(0, UITGEWERKT_GENOEMD);
	const meer = xs.length - genoemd.length;
	return `uitgewerkt in art. ${joinAnd(genoemd, { n: meer, one: 'andere', many: 'andere' })}`;
}

/** One sentence of the head of a regulation: `Op grond van` and the laws. */
export type KopDeel = { werkwoord: string; wetten: { key: string; naam: string }[] };

/**
 * The head of a regulation, from its `/basis`: the laws its Gelet op names, those that give
 * the power it is made under first (`Op grond van Cyberbeveiligingswet en Drinkwaterwet`),
 * then those it only names (`Noemt in de aanhef Algemene wet bestuursrecht`). The articles
 * stand in its group Grondslag.
 */
export function grondslagKopregel(
	items: readonly Pick<Schema<'InstrumentBasisItem'>, 'instrument' | 'basis_kind'>[]
): KopDeel[] {
	const wet = (i: (typeof items)[number]) => ({
		key: i.instrument.key,
		naam: i.instrument.citation_title ?? naamVan('instruments', i.instrument)
	});
	const genoemd = items.filter((i) => i.basis_kind === 'mentioned');
	const grond = items.filter((i) => i.basis_kind !== 'mentioned');
	return [
		{ werkwoord: grondslagWerkwoord(null), wetten: grond.map(wet) },
		{ werkwoord: grondslagWerkwoord(null, 'mentioned'), wetten: genoemd.map(wet) }
	].filter((d) => d.wetten.length > 0);
}

/**
 * The other laws a regulation's Gelet op names beside this one, its co-bases
 * (`also_based_on`): `mede op grond van Drinkwaterwet en Telecommunicatiewet`.
 */
export function medeOpGrondVan(
	wetten: readonly Pick<
		Schema<'InstrumentSummaryDTO'>,
		'id' | 'key' | 'citation_title' | 'display_name'
	>[]
): string | null {
	const namen = wetten.map((w) => w.citation_title ?? naamVan('instruments', w));
	return namen.length ? `mede ${grondslagWerkwoord(null).toLowerCase()} ${joinAnd(namen)}` : null;
}
