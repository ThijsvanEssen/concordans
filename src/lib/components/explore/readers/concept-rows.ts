// The rows of the block of a concept (ConceptBlok): the judgments and the papers that cite
// the articles of a concept, as the rows of Verbonden, so a row looks and opens as it does
// there. A row says which of the articles it is about; the verbinding itself is no line
// (no relation), because the block names no one article.
import { judgmentBase } from '$lib/verbonden/cited-by';
import { describeBron } from '$lib/bron/describe';
import { stuksoortOf } from '$lib/bron/rubrieken';
import { onDate } from '$lib/text/datum';
import { joinAnd } from '$lib/text/words';
import type { Row } from '$lib/verbonden/rows';
import type { Schema } from '$lib/api/types';

type Concept = Schema<'ConceptResponse'>;

/** `Art. 120 Gw`, `Art. 93 Gw en Art. 94 Gw`: the articles of the concept a bron is about, in the list's order. */
export function aboutArticles(concept: Concept, ids: readonly string[]): string | null {
	const names = concept.articles
		.filter((a) => ids.includes(a.id))
		.map((a) => a.display_name)
		.filter((n): n is string => !!n);
	return names.length ? joinAnd(names) : null;
}

export function judgmentRows(concept: Concept): Row[] {
	return concept.judgments.map(({ judgment: j, article_ids }) => ({
		...judgmentBase(j),
		// No ECLI in the line: the title is how a lawyer cites it.
		identifier: null,
		context: aboutArticles(concept, article_ids)
	}));
}

export function documentRows(concept: Concept): Row[] {
	return concept.documents.map(({ document: d, article_ids }) => {
		const props = { ...d };
		const about = aboutArticles(concept, article_ids);
		const base = describeBron('documents', d.key, d.title, props);
		// The day in full (onDate says it with its word, which the line leaves out); it stands before the articles.
		const day = d.date ? onDate(d.date).replace(/^op /, '') : null;
		return {
			ref: { collection: 'documents', key: d.key },
			...base,
			date: null,
			identifier: null,
			context: [day, about].filter(Boolean).join(', ') || null,
			filterGroup: 'stukken',
			stuksoort: stuksoortOf(props, null),
			props
		} as Row;
	});
}
