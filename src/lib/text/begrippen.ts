// The terms a regulation defines itself (its begripsbepalingen), where an article uses them
// (Thijs: hover over "de wet" shows what it is). The API marks each use (`term_spans`) and
// gives the definitions they name (`definitions`); a citation whose words are such a term
// names it too (`definition_ref`: "artikel 11 van de wet"). Nothing is read from the text.
// A regulation issued under a law takes that law's definitions where they reach it
// (`scope.reach`); such a definition names the law that gives it (`given_by`).
import { articleRef } from '$lib/text/bw';
import { truncate } from './words';
import type { Schema } from '$lib/api/types';
import { PREVIEW_CHARS, type Preview } from '$lib/bron/preview';

export type Definitie = Schema<'DefinitionDTO'>;
export type Begrip = Schema<'TermSpanDTO'>;

/**
 * The law a definition is taken from, by its citation title ("Cyberbeveiligingswet", not
 * "Cbw"); null for the regulation's own.
 */
export function gegevenDoor(d: Partial<Pick<Definitie, 'given_by'>>): string | null {
	const g = d.given_by;
	return g ? (g.citation_title ?? g.short_title ?? g.abbreviation ?? null) : null;
}

/**
 * Where the definition stands: `art. 1, onder a`; the article alone where its place has no
 * letter or digit (a dash or a bullet of the list is no place to cite). One taken from the law
 * the regulation is issued under names that law: `art. 1 Cyberbeveiligingswet`, or the law
 * alone where the article is unknown.
 */
export function plaatsVan(
	d: Pick<Definitie, 'article_number' | 'place'> & Partial<Pick<Definitie, 'given_by'>>
): string | null {
	const wet = gegevenDoor(d);
	if (!d.article_number) return wet;
	const place = d.place?.trim();
	const artikel = articleRef(null, d.article_number);
	if (place && /[\p{L}\p{N}]/u.test(place))
		return wet ? `${artikel}, onder ${place}, ${wet}` : `${artikel}, onder ${place}`;
	return wet ? `${artikel} ${wet}` : artikel;
}

/** The definition in one line: `wet: de Zorgverzekeringswet (art. 1, onder a)`. */
export function definitieRegel(d: Definitie): string {
	const plaats = plaatsVan(d);
	return `${d.term}: ${d.text}${plaats ? ` (${plaats})` : ''}`;
}

/** The link in the card of a defined term, for a finger that cannot follow it by a tap. */
export function readLabel(d: Pick<Definitie, 'article_number'>): string {
	return d.article_number ? `Lees ${articleRef(null, d.article_number)}` : 'Lees het artikel';
}

/** The card of a defined term, for the hover card every reference has (BronLink). */
export function definitieKaart(d: Definitie): Preview {
	const plaats = plaatsVan(d);
	return {
		kicker: plaats ? `Begrip, ${plaats}` : 'Begrip',
		title: d.term,
		date: null,
		lines: truncate(d.text, PREVIEW_CHARS)
	};
}

/** The definitions by the name a span gives them. */
export const definitiesOp = (list: readonly Definitie[] | null | undefined) =>
	new Map((list ?? []).map((d) => [d.ref, d]));
