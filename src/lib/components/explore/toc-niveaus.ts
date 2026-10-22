// How deep a table of contents goes: two levels at most (GOV.UK "contents list", NN/g on
// tables of contents), the same for a law, a stuk and a uitspraak. Deeper divisions are not
// rows of their own: the one level above them stands for them (the position marks it).

/** The most levels a contents list shows at rest. */
export const MAX_NIVEAUS = 2;

/**
 * The rows of a stuk's contents as the list shows them: the top level of the document is
 * level 1 whatever heading level it was written at, and what lies below level 2 is left out.
 */
export function niveaus<T extends { level: number }>(
	rows: readonly T[]
): (T & { niveau: number })[] {
	if (rows.length === 0) return [];
	const top = Math.min(...rows.map((r) => r.level));
	return rows
		.map((r) => ({ ...r, niveau: r.level - top + 1 }))
		.filter((r) => r.niveau <= MAX_NIVEAUS);
}
