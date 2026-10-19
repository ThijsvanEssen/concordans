// What is new in a bundel since the visit before, as Gevolgd says it of a topic: per law of the
// bundel one question to the feed (`instrument`), per dossier one (`dossier`), and per article
// the newest judgment that cites it (`cited-by`, newest first, one). Asked after the first
// paint, for the bundel on its own page only; a vote, a judgment and a source outside
// Concordans ask nothing.
import type { Schema } from '$lib/api/types';
import type { MapItem } from './map';

/** A line of the feed as the API gives it. */
export type FeedLine = Schema<'FeedItemDTO'>;

/** One question for what is new: by the group's key (a law, a dossier) or the item's id. */
export type FreshAsk =
	| { kind: 'law'; key: string; bwb: string }
	| { kind: 'dossier'; key: string; dossier: string }
	| { kind: 'article'; key: string; bwb: string; number: string };

const LAW_GROUP = /^wet:(bwb[rv]\d+)$/;
const DOSSIER_GROUP = /^dossier:(\d+(?:-[A-Za-z0-9()]*)?)$/;
const ARTICLE = /^articles\/(bwb[rv]\d+)_(.+)$/;

/** The questions of a bundel: its laws and dossiers first, by their first item, then its articles. */
export function freshAsks(items: readonly MapItem[]): FreshAsk[] {
	const groups = new Map<string, FreshAsk>();
	const articles = new Map<string, FreshAsk>();
	for (const i of items) {
		const law = LAW_GROUP.exec(i.groupKey);
		const dossier = DOSSIER_GROUP.exec(i.groupKey);
		if (law && !groups.has(i.groupKey))
			groups.set(i.groupKey, { kind: 'law', key: i.groupKey, bwb: law[1].toUpperCase() });
		else if (dossier && !groups.has(i.groupKey))
			groups.set(i.groupKey, { kind: 'dossier', key: i.groupKey, dossier: dossier[1] });
		const article = ARTICLE.exec(i.id);
		if (article && !articles.has(i.id))
			articles.set(i.id, {
				kind: 'article',
				key: i.id,
				bwb: article[1].toUpperCase(),
				number: article[2]
			});
	}
	return [...groups.values(), ...articles.values()];
}

/** An article's number as its key writes it: `3:2` is `3_2`. */
const asKey = (n: string | null | undefined) => (n ?? '').toLowerCase().replace(/[:.\s]+/g, '_');

/** What a line of the law's feed changes or proposes to change of the law's own articles. */
function articlesOf(f: FeedLine): string[] {
	const relation = f.via?.relation;
	// A regulation based on the law: its articles are its own, not the law's.
	if (relation === 'based_on' || relation === 'refers_to') return [];
	return [
		asKey(f.via?.article),
		...(relation === 'version_of' ? (f.commencement?.articles ?? []).map(asKey) : []),
		...(f.amends_articles ?? []).map((a) => a.key.slice(a.key.indexOf('_') + 1))
	].filter(Boolean);
}

/**
 * The lines of a law's or a dossier's feed that are new for an item: for an article what
 * changes it or proposes to, by its number; for the law or the dossier itself all of them; for
 * a paper of a dossier none (the dossier's group says what came in).
 */
export function freshLines(item: MapItem, feed: readonly FeedLine[]): FeedLine[] {
	const article = ARTICLE.exec(item.id);
	if (article) return feed.filter((f) => articlesOf(f).includes(article[2]));
	if (/^(?:instruments|dossiers)\//.test(item.id)) return [...feed];
	return [];
}

/** The newest judgment citing an article, as a bundel's row says it. */
export type Citing = { date: string; cite: string; place: string | null; href: string | null };

/** What a page of cited-by gives of each passage (ArticleCitedByResponse). */
type CitedByPage = {
	items: {
		judgment?: {
			date?: string | null;
			cite?: { short?: string | null; full?: string | null } | null;
			path?: string | null;
		} | null;
		paragraph_id?: string | null;
		paragraph_number?: string | null;
	}[];
};

/** The newest judgment of a page of cited-by (newest first), where decided after `since`. */
export function newestCiting(page: CitedByPage, since: string): Citing | null {
	const first = page.items[0];
	const j = first?.judgment;
	if (!j?.date || j.date <= since) return null;
	return {
		date: j.date,
		cite: j.cite?.full ?? j.cite?.short ?? '',
		place: first.paragraph_number ?? null,
		href: j.path ? `${j.path}${first.paragraph_id ? `#${first.paragraph_id}` : ''}` : null
	};
}
