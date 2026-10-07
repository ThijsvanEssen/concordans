// The labels under the judgments per year: the first and the last year, and the decades
// between them where there is room, so no label runs into another or past the edge.

/** The room a label takes, in px: a year at the size of a label, with some air. */
export const LABEL_PX = 32;

/**
 * The label of each column: the year, or '' where it stays empty. A decade keeps clear of the
 * first and the last label by as many columns as a label is wide. Without a width yet, the
 * decades stand as they are.
 */
export function axisLabels(years: readonly string[], width: number): string[] {
	const last = years.length - 1;
	const column = width > 0 && years.length ? width / years.length : 0;
	const clear = column ? Math.ceil(LABEL_PX / column) : 0;
	return years.map((year, i) => {
		if (i === 0 || i === last) return year;
		if (Number(year) % 10 !== 0) return '';
		return i >= clear && last - i >= clear ? year : '';
	});
}
