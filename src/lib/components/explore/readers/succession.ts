// The place of an article in a recodification (API `successors` and `predecessors`,
// `TRANSPOSED_TO`): the article of the new law that takes its place, or the article of the
// old law whose place it takes, as the transposition table gives them.
import type { Schema } from '$lib/api/types';
import { citeArticle } from '$lib/text/cite';
import { lawShortName } from '$lib/text/bw';
import { joinAnd, plural } from '$lib/text/words';

export type Succession = Schema<'ArticleSuccessionDTO'>;

/** The names of the law of the article on screen. */
export type OwnLaw = { citationTitle: string | null; shortTitle: string | null };

/** Which way the line reads: to the new law (`successors`) or from the old (`predecessors`). */
export type Direction = 'new' | 'old';

/**
 * The other article as a lawyer cites it: `art. 126ffa Sv`. A new code under the old one's
 * title without a short title of its own takes the old one's, marked: `art. 2.8.6 Sv (nieuw)`.
 */
export function successionName(s: Succession, own: OwnLaw, direction: Direction): string {
	const a = s.article;
	const number = a.article_number ?? '';
	const law = a.instrument;
	const short = lawShortName(law?.bwb_id, law?.abbreviation ?? law?.short_title);
	const title = law?.citation_title ?? law?.title ?? null;
	const sameTitle = !!title && !!own.citationTitle && title === own.citationTitle;
	if (!short && sameTitle) {
		const { kort } = citeArticle({
			bwbId: a.bwb_id,
			articleNumber: number,
			shortTitle: own.shortTitle,
			citationTitle: title
		});
		return `${kort} ${direction === 'new' ? '(nieuw)' : '(oud)'}`;
	}
	if (!title && !short) return a.display_name ?? `art. ${number}`;
	return citeArticle({
		bwbId: a.bwb_id,
		articleNumber: number,
		shortTitle: short,
		citationTitle: title ?? short ?? ''
	}).kort;
}

/** The status of the other law where it is not in force: `vastgesteld, nog niet in werking`. */
export function successionStatus(s: Succession): string | null {
	if (s.in_force !== false) return null;
	return `${s.status ?? 'vastgesteld'}, nog niet in werking`;
}

/** One row of the leden: the leden of the old article and their place in the new law. */
type PartRow = { old: string; place: string };

/**
 * The leden of the old article by their place in the new law, as the table writes it; the
 * leden that go to one place in one row: `leden 1, 2 en 3`, `2.8.6, 1`. Nothing for a whole
 * article that goes to one place: the line says that already.
 */
export function partRows(parts: Succession['parts']): PartRow[] {
	const byPlace = new Map<string, string[]>();
	for (const p of parts) {
		const olds = byPlace.get(p.new_place) ?? [];
		if (!olds.includes(p.old_part)) olds.push(p.old_part);
		byPlace.set(p.new_place, olds);
	}
	const rows = [...byPlace].map(([place, olds]) => {
		const leden = olds.filter(Boolean);
		const whole = leden.length < olds.length;
		const old = joinAnd([
			...(whole ? ['het artikel'] : []),
			...(leden.length ? [`${plural(leden.length, 'lid', 'leden')} ${joinAnd(leden)}`] : [])
		]);
		return { old, place };
	});
	return rows.length === 1 && rows[0].old === 'het artikel' ? [] : rows;
}

/** The tables the line rests on, each once, in the order of the list. */
export function successionSources(list: readonly Succession[]): string[] {
	return [...new Set(list.map((s) => s.source_url).filter((u): u is string => !!u))];
}
