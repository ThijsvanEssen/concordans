// The article of the Zijpaneel as it reads: its blocks (one per lid, onderdeel or aanhef, from
// /api/articles/{bwb}/{nr}/text), which of them the reference cites, and the names in its head.
import type { Schema } from '$lib/api/types';
import { anchorLabel } from '$lib/text/anchor';
import type { Span } from '$lib/text/segments';
import { isCollection } from '$lib/vocabulary';
import { joinAnd } from '$lib/text/words';

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

/**
 * What of an article a stapel shows: the part the reference cites, with the aanhef or lid it
 * stands in; the whole article where it cites none, or where no block is that part.
 */
export function citedBlocks(blocks: readonly TextBlock[], at: string | null): TextBlock[] {
	const cited = blocks.filter((b) => isCited(b, at));
	if (!cited.length) return [...blocks];
	const around = new Set(cited.flatMap((b) => b.within));
	return blocks.filter(
		(b) =>
			isCited(b, at) ||
			(b.anchor !== null && around.has(b.anchor)) ||
			(b.kind === 'aanhef' && b.within.some((w) => around.has(w)))
	);
}

/** An article's number in its key (`bwbr0052875_23` → `23`). */
const numberOf = (key: string): string => key.slice(key.indexOf('_') + 1);

/** A chip of the stapel's jump menu: the number and the place, `23 lid 1`. */
export const chipName = (key: string, at: string | null): string =>
	[numberOf(key), at ? anchorLabel(at) : null].filter(Boolean).join(' ');

/** The head of a stapel: `Art. 19, 23 lid 1 en 28 Cbb`; of several laws each its abbreviation. */
export function stackTitle(
	items: readonly { key: string; at: string | null }[],
	texts: readonly (ArticleTextData | null)[]
): string {
	const abbreviations = new Set(texts.map((a) => a?.law?.abbreviation ?? null));
	const one = abbreviations.size === 1 ? [...abbreviations][0] : null;
	const names = items.map((r, i) => {
		const own = one ? null : texts[i]?.law?.abbreviation;
		return [chipName(r.key, r.at), own].filter(Boolean).join(' ');
	});
	return `Art. ${joinAnd(names)}${one ? ` ${one}` : ''}`;
}

/** The line under a stapel's head: its law, where all its articles are of one. */
export function stackLaw(texts: readonly (ArticleTextData | null)[]): string | null {
	const laws = new Set(texts.map((a) => a?.law?.citation_title ?? a?.law?.title ?? null));
	return laws.size === 1 ? [...laws][0] : null;
}
