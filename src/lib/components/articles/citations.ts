import type { Schema } from '$lib/api/types';

/** The citations inside text[from, from + length), with offsets relative to `from`. */
export function citationsWithin(
	citations: Schema<'ArticleCitationSpan'>[],
	from: number,
	length: number
) {
	return citations
		.filter((c) => c.start != null && c.end != null)
		.filter((c) => c.start! >= from && c.end! <= from + length)
		.map((c) => ({ ...c, start: c.start! - from, end: c.end! - from }));
}
