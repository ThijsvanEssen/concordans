// The terms a regulation defines itself (its begripsbepalingen), where an article uses them
// (Thijs: hover over "de wet" shows what it is). The API marks each use (`term_spans`) and
// gives the definitions they name (`definitions`); a citation whose words are such a term
// names it too (`definition_ref`: "artikel 11 van de wet"). Nothing is read from the text.
import type { Schema } from '$lib/api/types';
import { PREVIEW_CHARS, type Preview } from '$lib/bron/preview';

export type Definitie = Schema<'DefinitionDTO'>;
export type Begrip = Schema<'TermSpanDTO'>;

/** Where the definition stands: `art. 1, onder a`; the article alone where it has no letter. */
export function plaatsVan(d: Pick<Definitie, 'article_number' | 'place'>): string | null {
	if (!d.article_number) return null;
	return d.place ? `art. ${d.article_number}, onder ${d.place}` : `art. ${d.article_number}`;
}

/** The definition in one line: `wet: de Zorgverzekeringswet (art. 1, onder a)`. */
export function definitieRegel(d: Definitie): string {
	const plaats = plaatsVan(d);
	return `${d.term}: ${d.text}${plaats ? ` (${plaats})` : ''}`;
}

/** The card of a defined term, for the hover card every reference has (BronLink). */
export function definitieKaart(d: Definitie): Preview {
	const plaats = plaatsVan(d);
	return {
		kicker: plaats ? `Begrip, ${plaats}` : 'Begrip',
		title: d.term,
		date: null,
		lines: d.text.length > PREVIEW_CHARS ? `${d.text.slice(0, PREVIEW_CHARS).trimEnd()}…` : d.text
	};
}

/** The terms inside text[from, from + length), with offsets relative to `from`. */
export function begrippenWithin(spans: readonly Begrip[], from: number, length: number): Begrip[] {
	return spans
		.filter((s) => s.start >= from && s.end <= from + length)
		.map((s) => ({ ...s, start: s.start - from, end: s.end - from }));
}

/** The definitions by the name a span gives them. */
export const definitiesOp = (list: readonly Definitie[] | null | undefined) =>
	new Map((list ?? []).map((d) => [d.ref, d]));
