// A list past what the API pages to. The Stukken are read to offset 10.000; beyond it the
// API answers 422 and a window of dates goes on (`to` the day of the last paper shown, the
// offset the papers of that day already shown).
/** The request for the rows from `offset` on, given the rows loaded; null where it cannot go on. */
export function requestFrom<Row, Query>(
	list: {
		reach?: number;
		beyond?: (query: Query, loaded: Row[]) => { query: Query; offset: number } | null;
	},
	query: Query,
	offset: number,
	loaded: Row[]
): { query: Query; offset: number; behind: number } | null {
	if (!list.reach || offset <= list.reach) return { query, offset, behind: 0 };
	const window = list.beyond?.(query, loaded);
	return window ? { ...window, behind: offset - window.offset } : null;
}
