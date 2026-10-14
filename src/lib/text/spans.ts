// The spans the API marks in a text (citations, defined terms, delegation formulas) are
// offsets in the whole text; a part of it (a lid, a paragraph) is read with its own.

/** The spans inside text[from, from + length), with offsets relative to `from`. */
export function spansWithin<T extends { start?: number | null; end?: number | null }>(
	spans: readonly T[],
	from: number,
	length: number
): (T & { start: number; end: number })[] {
	return spans.flatMap((s) =>
		s.start != null && s.end != null && s.start >= from && s.end <= from + length
			? [{ ...s, start: s.start - from, end: s.end - from }]
			: []
	);
}
