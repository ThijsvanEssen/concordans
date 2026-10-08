// Where a bron of a netwerk starts before the forces settle it: in the columns the homepage's
// schets draws (dossier and stukken, then the law and its articles, then the judgments), so the
// Verkenner opens in the shape the homepage promised (UX evaluation of 8 Oct, point 1).
import type { Collection } from '$lib/vocabulary';

/** The column of a kind: 0 parliament, 1 law, 2 judgments. */
export function kolomVan(collection: Collection): 0 | 1 | 2 {
	switch (collection) {
		case 'instruments':
		case 'instrument_versions':
		case 'articles':
		case 'article_versions':
		case 'annexes':
			return 1;
		case 'judgments':
			return 2;
		default:
			return 0;
	}
}

/**
 * The starting places of `ids` in three columns around (`cx`, `cy`), `breedte` apart, each
 * column spread over `hoogte` in the order given.
 */
export function kolomPlekken(
	ids: readonly { id: string; collection: Collection }[],
	cx: number,
	cy: number,
	breedte: number,
	hoogte: number
): Map<string, { x: number; y: number }> {
	const per: { id: string }[][] = [[], [], []];
	for (const n of ids) per[kolomVan(n.collection)].push(n);
	const plekken = new Map<string, { x: number; y: number }>();
	per.forEach((kolom, k) => {
		kolom.forEach((n, i) => {
			const y = kolom.length > 1 ? cy - hoogte / 2 + (i * hoogte) / (kolom.length - 1) : cy;
			plekken.set(n.id, { x: cx + (k - 1) * breedte, y });
		});
	});
	return plekken;
}
