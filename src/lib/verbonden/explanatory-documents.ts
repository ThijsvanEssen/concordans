// The explanatory documents of an article: only those that name it, not every toelichting of
// a dossier that also touched its law (`GET /api/articles/{bwb_id}/{n}/explained-by`).
import { getExplainedBy } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { type Row } from './rows';
import { describeBron } from '$lib/bron/describe';
import { isDerived } from './edge-meta';

/** The rows of `explained-by` that name the article itself, not its law at dossier level. */
export function rowsOfExplanations(items: Schema<'ArticleExplanationDTO'>[]): Row[] {
	const rows = new Map<string, Row>();
	for (const item of items) {
		if (item.scope !== 'article') continue;
		const d = item.document;
		if (rows.has(d.key)) continue;
		// `s-40` is the id of a section, not its number: it names no paragraph.
		const anchor = item.section_anchor;
		const section = anchor && !/^s-\d+$/.test(anchor) ? /(\d+(?:\.\d+)*)/.exec(anchor) : null;
		rows.set(d.key, {
			ref: { collection: 'documents', key: d.key },
			...describeBron('documents', d.key, d.title, { ...d }),
			filterGroup: 'toelichtingen',
			at: item.section_anchor ?? null,
			// The section by its heading as the memorie prints it (API 0.79.55): `§ Artikel 21
			// (zorgplicht)`; its opening comes with it (`excerpt`), on the row's second line.
			position: item.heading?.trim()
				? `§ ${item.heading.trim()}`
				: section
					? `§ ${section[1]}`
					: null,
			edge: { heading: item.heading ?? null, excerpt: item.excerpt ?? null },
			derived: isDerived(item.confidence),
			confidence: item.confidence ?? null,
			relation: 'EXPLAINS',
			direction: 'inbound',
			props: { ...d }
		});
	}
	return [...rows.values()];
}

export async function explanatoryDocuments(bwbId: string, number: string): Promise<Row[]> {
	// One request with the reader (`getExplainedBy`).
	const data = await getExplainedBy(bwbId, number);
	return rowsOfExplanations(data?.items ?? []);
}
