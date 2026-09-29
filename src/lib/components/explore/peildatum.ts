// The whole law as it applied on a day (`?peildatum=2015-01-01`): which version covers
// the day, the versions per year for the list, and the articles of that day with their
// place in the law.
import type { Schema } from '$lib/api/types';

type Version = Pick<Schema<'InstrumentVersionDTO'>, 'valid_from' | 'valid_until' | 'current'>;
type Current = Pick<
	Schema<'InstrumentArticleNodeDTO'>,
	'key' | 'article_number' | 'label' | 'breadcrumb'
>;
type AtItem = Pick<
	Schema<'InstrumentArticleVersionDTO'>,
	'key' | 'article_number' | 'text' | 'text_preview' | 'valid_from' | 'valid_until'
>;

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
	breadcrumb: Current['breadcrumb'];
	text: string | null;
	text_preview: string | null;
};

/**
 * The articles of a day with their place. The API gives an old version without its
 * place in the law; an article that still exists takes the place it has now.
 * TODO(backend): breadcrumb, label and heading on `/articles/at/{date}`.
 */
export function atArticles(items: AtItem[], current: Current[]): AtArticle[] {
	const byNumber = new Map(
		current.filter((c) => c.article_number).map((c) => [c.article_number!, c])
	);
	return items.map((i) => {
		const now = i.article_number ? byNumber.get(i.article_number) : undefined;
		return {
			id: i.key,
			key: now?.key ?? null,
			article_number: i.article_number ?? null,
			label: now?.label ?? null,
			breadcrumb: now?.breadcrumb ?? [],
			text: i.text ?? null,
			text_preview: i.text_preview ?? null
		};
	});
}
