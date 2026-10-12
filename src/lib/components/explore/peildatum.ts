// The whole law as it applied on a day (`?peildatum=2015-01-01`): which version covers
// the day, the versions per year for the list, and the articles of that day with their
// place in the law as it was that day.
import type { Schema } from '$lib/api/types';

type Version = Pick<Schema<'InstrumentVersionDTO'>, 'valid_from' | 'valid_until' | 'current'>;
type Part = Schema<'ArticlePartSpanDTO'>;
type Current = Pick<Schema<'InstrumentArticleNodeDTO'>, 'key' | 'article_number'>;
type AtItem = Pick<
	Schema<'InstrumentArticleVersionDTO'>,
	| 'key'
	| 'article_number'
	| 'label'
	| 'breadcrumb'
	| 'text'
	| 'text_preview'
	| 'valid_from'
	| 'valid_until'
> &
	// An API before 0.79.52 gives no parts.
	Partial<Pick<Schema<'InstrumentArticleVersionDTO'>, 'parts'>>;

/** A day as the URL and the API write it. */
export const isDay = (s: string | null | undefined): s is string =>
	!!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** The version in force on `day`: from its first day up to, not including, its end. */
export function versionOn<V extends Version>(versions: V[], day: string): V | null {
	return (
		versions.find(
			(v) => !!v.valid_from && v.valid_from <= day && (!v.valid_until || day < v.valid_until)
		) ?? null
	);
}

/** The versions by the year they took effect, newest first, as the list groups them. */
export function versionsByYear<V extends Version>(versions: V[]): [string, V[]][] {
	const out: [string, V[]][] = [];
	const sorted = [...versions]
		.filter((v) => v.valid_from)
		.sort((a, b) => b.valid_from!.localeCompare(a.valid_from!));
	for (const v of sorted) {
		const year = v.valid_from!.slice(0, 4);
		const last = out.at(-1);
		if (last?.[0] === year) last[1].push(v);
		else out.push([year, [v]]);
	}
	return out;
}

export type AtArticle = {
	/** The version of the article: unique in the list. */
	id: string;
	/** The article as it is now, to link to; null when it is no longer in the law. */
	key: string | null;
	article_number: string | null;
	label: string | null;
	/** The divisions the article stood in on that day. */
	breadcrumb: NonNullable<AtItem['breadcrumb']>;
	text: string | null;
	/** Its aanhef, leden and onderdelen in that text; null from an API without them. */
	parts: Part[] | null;
	text_preview: string | null;
};

/**
 * The articles of a day. Their place is that of the day, as the API gives it; today's list
 * only says which article to link to, and which is no longer in the law.
 */
export function atArticles(items: AtItem[], current: Current[]): AtArticle[] {
	const byNumber = new Map(
		current.filter((c) => c.article_number).map((c) => [c.article_number!, c.key])
	);
	return items.map((i) => ({
		id: i.key,
		key: (i.article_number && byNumber.get(i.article_number)) || null,
		article_number: i.article_number ?? null,
		label: i.label ?? null,
		breadcrumb: i.breadcrumb ?? [],
		text: i.text ?? null,
		parts: i.parts?.length ? i.parts : null,
		text_preview: i.text_preview ?? null
	}));
}
