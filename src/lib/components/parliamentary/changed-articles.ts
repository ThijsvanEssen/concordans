// The articles a bill changes, per law (GET /api/dossiers/{number}/changed-articles, API
// 0.74.0): what the dossier reader shows under "Gewijzigde artikelen".
import { naamVanId } from '$lib/bron/menselijk';
import type { Schema } from '$lib/api/types';
import { bookNumber } from '$lib/text/bw';
import { langeDatum } from '$lib/text/datum';
import { CHANGE_HEAD } from '$lib/verbonden/hoe';
import { changeRelation } from '$lib/vocabulary';

type ChangedArticle = Schema<'ChangedArticleRef'>;
export type DossierChange = Schema<'DossierChange'>;
export type ChangedLaw = Schema<'DossierChangedLaw'>;
export type ChangedArticles = Schema<'DossierChangedArticlesResponse'>;
export type LegalEffectLaw = NonNullable<Schema<'LegalEffectDTO'>['amends']>[number];

/**
 * The laws the dossier changes (`legal_effect.amends`, the band's Wijzigt) that hold no
 * changed article in the data: named under Gewijzigde artikelen too, so the reader counts the
 * laws once (Thijs, 10 Oct: "single count").
 */
export function zonderArtikelen(data: ChangedArticles, wijzigt: readonly LegalEffectLaw[]) {
	const bekend = new Set(
		data.laws.flatMap((l) =>
			[l.law.id?.replace(/^instruments\//, ''), l.law.bwb_id, l.law.celex]
				.filter((x): x is string => !!x)
				.map((x) => x.toLowerCase())
		)
	);
	return wijzigt.filter(
		(w) => ![w.key, w.bwb_id, w.celex].some((x) => x && bekend.has(x.toLowerCase()))
	);
}

/** What a change does to the article, as the first word of its line: `Wijziging`, `Vervalt`. */
export const changeHead = (c: DossierChange) => CHANGE_HEAD[changeRelation(c.relation)];

/** One article of a law with its changes, in the order the API gives (that of the law). */
type ArticleChanges = { article: ChangedArticle; changes: DossierChange[] };

export function byArticle(changes: DossierChange[]): ArticleChanges[] {
	const out = new Map<string, ArticleChanges>();
	for (const c of changes) {
		const at = out.get(c.article.id);
		if (at) at.changes.push(c);
		else out.set(c.article.id, { article: c.article, changes: [c] });
	}
	return [...out.values()];
}

/** The name of an article inside its law's group: "Artikel 21b", "Artikel 6:162". */
export function articleLabel(law: ChangedLaw['law'], a: ChangedArticle): string {
	const nr = a.article_number?.trim();
	if (nr && !/\s/.test(nr)) return `Artikel ${bookNumber(law.bwb_id ?? law.celex, nr)}`;
	return naamVanId(a.id, a.display_name);
}

/** What stands before the publication or paper on a change's line, its own spaces included. */
export function stageLead(c: DossierChange): string {
	if (c.stage === 'proposed') return 'voorgesteld in ';
	return c.effective_date ? `in werking sinds ${langeDatum(c.effective_date)}, ` : '';
}

/**
 * The one way every change of a law came into force, where they share it (36264: all by
 * Stb. 2026, 154 on 1 September 2026): said once under the law, not on every article.
 */
export function sharedEnactment(l: ChangedLaw): DossierChange | null {
	const [first, ...rest] = l.changes;
	if (!first || first.stage !== 'enacted') return null;
	const same = rest.every(
		(c) =>
			c.stage === 'enacted' &&
			c.source.id === first.source.id &&
			c.effective_date === first.effective_date
	);
	return same ? first : null;
}
