// The article of the Leespaneel as it reads: its blocks (one per lid, onderdeel or aanhef, from
// /api/articles/{bwb}/{nr}/text), which of them the reference cites, and the names in its head.
import type { Schema } from '$lib/api/types';
import { anchorLabel } from '$lib/text/anchor';
import type { Span } from '$lib/text/segments';
import { isCollection } from '$lib/vocabulary';

export type ArticleTextData = Schema<'ArticleTextDTO'>;
export type TextBlock = Schema<'ArticleTextBlockDTO'>;

/** The links of a block as CitedText takes them: spans of a citation, to a bron it knows. */
export const spansOf = (b: TextBlock): Span[] =>
	b.links.flatMap(({ target, ...l }) => {
		const { collection } = target;
		if (!isCollection(collection)) return [];
		const span: Span = {
			...l,
			target: { ...target, collection, display_name: null },
			kind: 'article',
			reference_kind: null,
			confidence: null,
			definition_ref: null
		};
		return [span];
	});

/** Whether the reference cites this block: the place itself, or a place it stands in. */
export const isCited = (b: TextBlock, at: string | null): boolean =>
	!!at && (b.anchor === at || b.within.includes(at));

/** How the head names the article: `Artikel 68 Cbw`, else as it is cited. */
export function panelTitle(a: ArticleTextData): string {
	const abbreviation = a.law?.abbreviation;
	if (a.label && abbreviation) return `${a.label} ${abbreviation}`;
	return a.label ?? a.display_name ?? 'Artikel';
}

/** The line under it: its law and its heading, `Cyberbeveiligingswet (toezichthouders)`. */
export const lawLine = (a: ArticleTextData): string =>
	[a.law?.citation_title ?? a.law?.title, a.heading].filter(Boolean).join(' ');

/** A neighbour as the row before and after names it: `Art. 67`. */
export const neighborName = (b: Schema<'ArticleNeighborDTO'>): string =>
	(b.label ?? `Artikel ${b.address}`).replace(/^Artikel\b/, 'Art.');

/** What a screen reader hears on opening: `Artikel 68 Cbw, lid 1 geciteerd. Esc sluit.` */
export function announcement(a: ArticleTextData, at: string | null, keys: boolean): string {
	const place = at ? anchorLabel(at) : null;
	const esc = keys ? ' Esc sluit.' : '';
	return `${panelTitle(a)}${place ? `, ${place} geciteerd` : ''}.${esc}`;
}
