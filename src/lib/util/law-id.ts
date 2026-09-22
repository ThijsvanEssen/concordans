/**
 * Helpers for extracting a law/instrument identifier from node props or API
 * response objects. Dutch laws use a BWB id (e.g. BWBR0001854); EU laws use a
 * CELEX number (e.g. 32010L0064) stored in the `celex` prop or encoded in the
 * article key as `{celex}_{article_number}`. Both are valid instrument ids and
 * should be treated uniformly.
 */

/**
 * Extract the instrument id from a graph-node's raw props object.
 * Returns null when no identifier can be determined.
 */
export function getLawIdFromProps(
	props: Record<string, unknown> | undefined,
	nodeKey?: string
): string | null {
	const explicit =
		(props?.['bwb_id'] as string | null | undefined) ??
		(props?.['celex'] as string | null | undefined);
	if (explicit) return String(explicit);

	// EU article: celex encoded in the key as "{celex}_{article_number}".
	if (nodeKey) {
		const artNum = props?.['article_number'] as string | null | undefined;
		if (artNum && nodeKey.endsWith('_' + String(artNum))) {
			return nodeKey.slice(0, -(String(artNum).length + 1)) || null;
		}
	}
	return null;
}

/**
 * Extract the instrument id from an API record that has `bwb_id` and `key`
 * fields (ArticleCitationTarget, ArticleSummaryDTO, ...).
 * Falls back to `__unknown__` so grouping functions still work.
 */
export function getLawIdFromRecord(record: {
	bwb_id?: string | null;
	key: string;
	article_number?: string | null;
}): string {
	if (record.bwb_id) return record.bwb_id;
	const artNum = record.article_number;
	if (artNum && record.key.endsWith('_' + artNum)) {
		return record.key.slice(0, -(artNum.length + 1)) || '__unknown__';
	}
	return '__unknown__';
}

/** The instrument id an article key starts with: `bwbr0001854_287`, `32004l0017_6`. */
export function lawIdOfArticleKey(key: string): string | null {
	const m = /^(bwb[rvw]\d{7}|[0-9ce]\d{4}[a-z]{1,2}\d{4})_/i.exec(key);
	return m ? m[1].toUpperCase() : null;
}

/**
 * What `/api/articles/{law}/{number}` wants for an article node. The law is a BWB id
 * for a Dutch article and a CELEX number for a European one; every reader goes through here.
 */
export function articleIdentity(
	props: Record<string, unknown> | undefined,
	nodeKey: string
): { lawId: string; articleNumber: string } | null {
	const lawId = getLawIdFromProps(props, nodeKey) ?? lawIdOfArticleKey(nodeKey);
	const stated = props?.['article_number'];
	const articleNumber =
		typeof stated === 'string' && stated
			? stated
			: lawId && nodeKey.toLowerCase().startsWith(`${lawId.toLowerCase()}_`)
				? nodeKey.slice(lawId.length + 1)
				: '';
	return lawId && articleNumber ? { lawId, articleNumber } : null;
}
