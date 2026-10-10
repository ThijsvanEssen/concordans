// Figures in Dutch notation, in one place as the dates are in datum.ts: `1.104`, `12,5`.

/** A count: `1.104`. */
export const formatCount = (n: number): string => n.toLocaleString('nl-NL');

/** A share or a measure with at most `decimals` decimals: `12,5`. */
export const formatDecimal = (n: number, decimals = 1): string =>
	n.toLocaleString('nl-NL', { maximumFractionDigits: decimals });
