// The judgments that cite an article, from `cited-by` (one item per passage): one row per
// judgment, each overweging that cites the article a mention of it. The group in Verbonden
// and the canvas card of the same verbinding read them here, so they name the same lid.
import type { Schema } from '$lib/api/types';
import { paragraphAnchor } from '$lib/text/anchor';
import { paragraphCite } from '$lib/text/ecli';
import { isDerived, lidOfMatch } from './edge-meta';
import { isInternational } from '$lib/vocabulary';
import { bundleMentions, type Row } from './rows';
import { describeBron } from '$lib/bron/describe';

/**
 * One row per judgment. With `withCount` (the order Meest aangehaald) a row says how often the
 * judgment itself is cited, not how often it names the article.
 */
export function rowsOfCitedBy(items: Schema<'ArticleCitedByItem'>[], withCount = false): Row[] {
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
			...describeBron('judgments', j.key, j.display_name, { ...j }, j.cite),
			filterGroup: 'uitspraken',
			cited: withCount ? (j.inbound_citation_count ?? null) : null,
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
