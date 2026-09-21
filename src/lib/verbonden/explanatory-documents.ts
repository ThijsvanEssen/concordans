// TODO(backend B4): nothing lists the explanatory documents of an article. EXPLAINS often
// points at an article version or at the instrument, which the article's routes do not
// follow. This module merges the two things the API does have: the documents that point
// at the article itself (its node response), and the toelichtingen in the dossiers of its
// law. When `GET /api/articles/{bwb_id}/{n}/explained-by` exists, `explanatoryDocuments`
// is that one request and the merge goes.
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import { isExplanatory } from './chamber';
import { describe, type Neighbor, type Row } from './rows';

type BulkDocuments = Schema<'DossierDocumentsBulkResponse'>;

/** The relations by which a document is tied to the article's text, not only names it. */
const BINDING = new Set(['EXPLAINS', 'AMENDS', 'INTRODUCES']);

type Found = { row: Row; date: string; binding: boolean };

export function mergeExplanatory(neighbors: Neighbor[], bulk: BulkDocuments | null): Row[] {
	const found = new Map<string, Found>();

	for (const n of neighbors) {
		const props = n.props ?? {};
		if (n.collection !== 'documents' || n.direction !== 'inbound') continue;
		if (!isExplanatory(props.kind as string | null)) continue;
		const binding = BINDING.has(n.relation ?? '');
		const known = found.get(n.key);
		if (known && (known.binding || !binding)) continue;
		found.set(n.key, {
			binding,
			date: typeof props.date === 'string' ? props.date : '',
			row: {
				ref: { collection: 'documents', key: n.key },
				...describe('documents', n.key, n.display_name, props),
				// A document that only names the article may explain another one.
				derived: !binding || (n.confidence != null && n.confidence < 1),
				relation: 'EXPLAINS',
				direction: 'inbound'
			}
		});
	}

	// The toelichting of a dossier of the law explains the law, and with it the article:
	// true at the level of the dossier, a guess at the level of the article.
	for (const documents of Object.values(bulk?.items ?? {})) {
		for (const d of documents) {
			if (found.has(d.key) || !isExplanatory(d.kind)) continue;
			found.set(d.key, {
				binding: false,
				date: d.date ?? '',
				row: {
					ref: { collection: 'documents', key: d.key },
					...describe('documents', d.key, d.display_name, { ...d }),
					derived: true,
					relation: 'EXPLAINS',
					direction: 'inbound'
				}
			});
		}
	}

	// The API cannot say which dossier made the version on screen. Documents bound to
	// the article come first, then the newest.
	return [...found.values()]
		.sort((a, b) => Number(b.binding) - Number(a.binding) || b.date.localeCompare(a.date))
		.map((f) => f.row);
}

/** The most dossiers of a law whose documents are asked for, in one bulk request. */
const MAX_DOSSIERS = 12;

export async function explanatoryDocuments(
	article: { bwbId: string | null },
	neighbors: Neighbor[],
	signal?: AbortSignal
): Promise<Row[]> {
	let bulk: BulkDocuments | null = null;
	if (article.bwbId) {
		try {
			const dossiers = await unwrap(
				api.GET('/api/instruments/{bwb_id}/dossiers', {
					params: { path: { bwb_id: article.bwbId } },
					signal
				})
			);
			const numbers = dossiers.items.slice(0, MAX_DOSSIERS).map((d) => d.dossier_number ?? d.key);
			if (numbers.length > 0) {
				// The bulk route returns the newest 50 documents of a dossier, without a filter
				// on kind: the toelichting of a long dossier falls outside it.
				bulk = await unwrap(
					api.GET('/api/dossiers/documents/bulk', {
						params: { query: { numbers: numbers.join(','), per_dossier_limit: 50 } },
						signal
					})
				);
			}
		} catch {
			// The law's dossiers are an addition; without them the article's own documents remain.
		}
	}
	return mergeExplanatory(neighbors, bulk);
}
