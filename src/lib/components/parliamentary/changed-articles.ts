// The articles a bill changes, per law (GET /api/dossiers/{number}/changed-articles, API
// 0.74.0): what the dossier reader shows under "Gewijzigde artikelen".
// TODO(sync 0.74.0): the types below and the fetch go to the generated client.
import { API_BASE_URL } from '$lib/api/base-url';
import { bookNumber } from '$lib/text/bw';
import { langeDatum } from '$lib/text/datum';

export type ChangedArticle = {
	id: string;
	/** Null for an article that is not in the graph. */
	key: string | null;
	article_number?: string | null;
	display_name?: string | null;
	stub?: boolean;
};

export type ChangeSource = {
	id: string;
	key?: string | null;
	display_name?: string | null;
	/** Of a publication, its id on officielebekendmakingen.nl (`stb-2026-154`). */
	official_id?: string | null;
};

export type DossierChange = {
	article: ChangedArticle;
	relation: 'amends' | 'introduces' | 'repeals';
	stage: 'enacted' | 'proposed';
	source: ChangeSource;
	/** Of an enacted change, the day it takes effect. */
	effective_date?: string | null;
};

export type ChangedLaw = {
	law: {
		id: string | null;
		bwb_id?: string | null;
		celex?: string | null;
		display_name?: string | null;
	};
	total: number;
	changes: DossierChange[];
};

export type ChangedArticles = {
	number: string;
	total: number;
	articles: number;
	enacted: number;
	proposed: number;
	laws: ChangedLaw[];
};

/** The changes of a dossier, or null where the API has none to give (an older API: 404). */
export async function getChangedArticles(
	number: string,
	signal?: AbortSignal
): Promise<ChangedArticles | null> {
	const res = await fetch(
		`${API_BASE_URL}/api/dossiers/${encodeURIComponent(number)}/changed-articles`,
		{ signal }
	);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`changed-articles ${res.status}`);
	return (await res.json()) as ChangedArticles;
}

/** What a change does to the article, as the first word of its line. */
export const RELATION_WORD: Record<DossierChange['relation'], string> = {
	amends: 'Wijziging',
	introduces: 'Nieuw artikel',
	repeals: 'Vervalt'
};

/** One article of a law with its changes, in the order the API gives (that of the law). */
export type ArticleChanges = { article: ChangedArticle; changes: DossierChange[] };

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
	return a.display_name ?? a.id;
}

/** "24 artikelen in 1 wet. 24 wijzigingen in werking." The counts that are zero go. */
export function summary(d: ChangedArticles): string {
	const n = (count: number, one: string, more: string) => `${count} ${count === 1 ? one : more}`;
	const laws = d.laws.length;
	const first = `${n(d.articles, 'artikel', 'artikelen')} in ${n(laws, 'wet', 'wetten')}.`;
	const stages = [
		d.enacted ? `${n(d.enacted, 'wijziging', 'wijzigingen')} in werking` : null,
		d.proposed ? `${n(d.proposed, 'wijziging', 'wijzigingen')} voorgesteld` : null
	].filter(Boolean);
	return stages.length ? `${first} ${stages.join(', ')}.` : first;
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
