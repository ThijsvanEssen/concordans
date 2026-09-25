// A dossier is named by its number and, where the Tweede Kamer gives one, a suffix
// (`Toevoeging`): `37035-XXII`, `21501-31`, `23908-(R1519)`. Each label is a dossier of its
// own; the dossiers that share a number belong together (the chapters of one budget, the
// meetings of one Council series).

/** `37035` for `37035-XXII`, `37035` for `37035`. */
export const numberOf = (label: string): string => label.split('-')[0];

/** `XXII` for `37035-XXII`; `null` for a dossier without suffix. */
export const suffixOf = (label: string): string | null =>
	label.slice(numberOf(label).length + 1) || null;

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };

// A budget chapter is a Roman numeral with at most a letter after it (`IIA`, `IXB`). A fund
// is a letter (`A`, `M`); `L`, `C` and `M` are funds, never chapter numerals.
function romanValue(numeral: string): number {
	let total = 0;
	for (let i = 0; i < numeral.length; i++) {
		const value = ROMAN[numeral[i]];
		const next = ROMAN[numeral[i + 1]] ?? 0;
		total += value < next ? -value : value;
	}
	return total;
}

function suffixKey(label: string): [number, number, string] {
	const suffix = suffixOf(label);
	if (!suffix) return [0, 0, ''];
	if (/^\d+$/.test(suffix)) return [1, Number(suffix), ''];
	const roman = /^([IVX]+)([A-C])?$/.exec(suffix);
	if (roman) return [2, romanValue(roman[1]), roman[2] ?? ''];
	return [3, 0, suffix];
}

/** Orders labels of one number as the Kamer does: no suffix, numbers, chapters, funds. */
export function compareSuffix(a: string, b: string): number {
	const [x, y] = [suffixKey(a), suffixKey(b)];
	return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], 'nl');
}

/**
 * The rows in runs of one number, in the order the first row of each number comes.
 * Rows of one number are ordered by `compareSuffix`.
 */
export function groupByNumber<T extends { number: string }>(
	rows: T[]
): { number: string; rows: T[] }[] {
	const groups = new Map<string, T[]>();
	for (const row of rows) {
		const number = numberOf(row.number);
		const group = groups.get(number);
		if (group) group.push(row);
		else groups.set(number, [row]);
	}
	return [...groups].map(([number, members]) => ({
		number,
		rows: members.sort((a, b) => compareSuffix(a.number, b.number))
	}));
}
