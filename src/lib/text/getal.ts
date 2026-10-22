// Figures in Dutch notation, in one place as the dates are in datum.ts: `1.104`, `12,5`.

/** A count: `1.104`. */
export const formatCount = (n: number): string => n.toLocaleString('nl-NL');

/** A count the list holds more than: `meer dan 250`, never `250+` (B33); else `250`. */
export const atLeast = (n: number, more: boolean): string =>
	more ? `meer dan ${formatCount(n)}` : formatCount(n);

/** Whether a count says more than it holds (`atLeast`): "Alle meer dan 30" reads wrong. */
export const isAtLeast = (label: string): boolean => label.startsWith('meer dan ');

/** A share or a measure with at most `decimals` decimals: `12,5`. */
export const formatDecimal = (n: number, decimals = 1): string =>
	n.toLocaleString('nl-NL', { maximumFractionDigits: decimals });

/** The ordinals a lid is named by in words, up to twenty: `tweede lid`. */
export const ORDINAL_WORDS = [
	'eerste',
	'tweede',
	'derde',
	'vierde',
	'vijfde',
	'zesde',
	'zevende',
	'achtste',
	'negende',
	'tiende',
	'elfde',
	'twaalfde',
	'dertiende',
	'veertiende',
	'vijftiende',
	'zestiende',
	'zeventiende',
	'achttiende',
	'negentiende',
	'twintigste'
] as const;

/** `2` is `tweede`; a lid beyond twenty, or `2a`, keeps its number: null. */
export const ordinalWord = (lid: string): string | null => {
	const n = /^\d+$/.test(lid) ? Number(lid) : NaN;
	return n >= 1 && n <= ORDINAL_WORDS.length ? ORDINAL_WORDS[n - 1] : null;
};

/** `tweede` is `2`; null for a word that is no ordinal up to twenty. */
export const ordinalNumber = (word: string): string | null => {
	const i = (ORDINAL_WORDS as readonly string[]).indexOf(word.toLowerCase());
	return i < 0 ? null : String(i + 1);
};
