// The explanatory documents of an article: only those that actually name it, not every
// toelichting of a dossier that also touched its law. API 0.5 lists them on
// `GET /api/articles/{bwb_id}/{n}/explained-by`. Before that they are read here from the
// documents that point at the article in its own node response.
// TODO(backend B4): the fallback goes when every article answers on `explained-by`.
import { getExplainedBy } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { isExplanatory } from './chamber';
import { describe, type Neighbor, type Row } from './rows';
import { isDerived, readEdge } from './edge-meta';

/**
 * The relations by which a document is tied to the article's text. A toelichting that
 * only names the article (REFERS_TO) explains another law and is left out.
 */
const BINDING = new Set(['EXPLAINS', 'AMENDS', 'INTRODUCES']);

type Found = { row: Row; date: string; binding: boolean };

export function mergeExplanatory(neighbors: Neighbor[]): Row[] {
	const found = new Map<string, Found>();

	for (const n of neighbors) {
		const props = n.props ?? {};
		if (n.collection !== 'documents' || n.direction !== 'inbound') continue;
		if (
			!isExplanatory({
				kind: props.kind as string | null,
				is_explanatory: props.is_explanatory as boolean | null
			})
		)
			continue;
		if (!BINDING.has(n.relation ?? '') || found.has(n.key)) continue;
		const edge = readEdge(n.meta as Record<string, unknown> | null, {
			direction: 'inbound',
			citingEcli: null
		});
		found.set(n.key, {
			binding: true,
			date: typeof props.date === 'string' ? props.date : '',
			row: {
				ref: { collection: 'documents', key: n.key },
				...describe('documents', n.key, n.display_name, props),
				kind: 'toelichtingen',
				lid: edge.lid,
				derived: isDerived(n.confidence),
				confidence: n.confidence ?? null,
				edgeId: n.edge_id ?? null,
				snippet: edge.snippet,
				match: edge.match,
				relation: 'EXPLAINS',
				direction: 'inbound',
				props
			}
		});
	}

	// Documents bound to the article, newest first. A dossier's other toelichting is not
	// read at all: without a confirmed edge to this article it would only ever be a
	// guess that it was named, and the panel shows it named or not at all.
	return [...found.values()]
		.filter((f) => f.binding)
		.sort((a, b) => b.date.localeCompare(a.date))
		.map((f) => f.row);
}

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
			...describe('documents', d.key, d.title, { ...d }),
			kind: 'toelichtingen',
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

export async function explanatoryDocuments(
	article: { bwbId: string | null; number: string | null },
	neighbors: () => Promise<Neighbor[]>
): Promise<Row[]> {
	if (article.bwbId && article.number) {
		// One request with the reader (`getExplainedBy`); an empty answer means the pipeline
		// has not reached this article: the fallback still applies.
		const data = await getExplainedBy(article.bwbId, article.number);
		if (data && data.items.length > 0) return rowsOfExplanations(data.items);
	}
	return mergeExplanatory(await neighbors());
}
