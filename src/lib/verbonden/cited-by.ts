// The judgments that cite an article, from `cited-by` (one item per passage): one row per
// judgment, each overweging that cites the article a mention of it. The group in Verbonden
// and the canvas card of the same verbinding read them here, so they name the same lid.
import type { Schema } from '$lib/api/types';
import { paragraphAnchor } from '$lib/text/anchor';
import { paragraphCite } from '$lib/text/judgment-cite';
import { isDerived, lidOfMatch } from './edge-meta';
import { isInternational } from './filter';
import { bundleMentions, describe, type Row } from './rows';

/** The passages of the judgments that cite an article, a page: as many as the API gives. */
export const CITED_BY_PAGE = 200;

export function rowsOfCitedBy(items: Schema<'ArticleCitedByItem'>[]): Row[] {
	const mentions = new Map<string, Map<string, Row>>();
	for (const item of items) {
		const j = item.judgment;
		// The ECHR judgments are no passage (HUDOC names the article, not the place).
		if (isInternational({ key: j.key, props: {} })) continue;
		const at =
			item.paragraph_id || (item.paragraph_number ? paragraphAnchor(item.paragraph_number) : null);
		const of = mentions.get(j.key) ?? new Map<string, Row>();
		mentions.set(j.key, of);
		if (of.has(at ?? '')) continue;
		of.set(at ?? '', {
			ref: { collection: 'judgments', key: j.key },
			...describe('judgments', j.key, j.display_name, { ...j }),
			kind: 'uitspraken',
			at,
			lid: item.leden?.[0] ?? lidOfMatch(item.qualifier ?? item.text),
			position: item.paragraph_number ? paragraphCite(j.key, item.paragraph_number) : null,
			derived: isDerived(item.confidence),
			confidence: item.confidence,
			snippet: item.snippet || null,
			match: item.text || null,
			passageAt: at,
			relation: 'REFERS_TO',
			direction: 'inbound',
			props: { ...j }
		});
	}
	return [...mentions.values()].map((of) => bundleMentions([...of.values()]));
}
