// The small turns of Dutch every line of Concordans takes, in one place: a node prop read as
// text, a capital, a count with its noun, "a, b en c", a kind without its group, a text cut
// with "…", and a word made safe for a pattern.

/** A node prop (untyped in the API schema) as text, trimmed; null when it is none or blank. */
export const textOf = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/** `Van den Berg` from `van den Berg`: a capital at the head of a line. */
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `minister van Financiën` from `Minister van Financiën`: a word inside a sentence. */
export const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** The noun for `n`: `zetel` for one, `zetels` for any other number. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** `1 zetel`, `22 zetels`. */
export const count = (n: number, one: string, many: string): string =>
	`${n} ${plural(n, one, many)}`;

export type Part = string | number | null | undefined | false;

/** Parts of a line with a comma, the empty ones left out: "Uitspraak, Hoge Raad". */
export const joinParts = (parts: readonly Part[], separator = ', '): string =>
	parts
		.filter((d): d is string | number => d !== null && d !== undefined && d !== false)
		.map((d) => String(d).trim())
		.filter(Boolean)
		.join(separator);

/** What stands before the `i`th of `n` names: nothing, `, ` or ` en `; a comma before `more`. */
export const separatorBefore = (i: number, n: number, more = false): string =>
	i === 0 ? '' : i === n - 1 && !more ? ' en ' : ', ';

/** The others past a list, `en 3 andere`, counted with their own noun. */
export type Others = { n: number; one: string; many: string };

/** `a`, `a en b`, `a, b en c`; with others, `a, b en 3 andere`. */
export function joinAnd(parts: readonly string[], others?: Others): string {
	if (others && others.n > 0) {
		const rest = count(others.n, others.one, others.many);
		return parts.length ? `${parts.join(', ')} en ${rest}` : rest;
	}
	return parts.map((p, i) => separatorBefore(i, parts.length) + p).join('');
}

/**
 * A text of at most `max` characters, "…" included. Cut `atWord`, it ends on a whole word
 * where one ends past half of `max`, and loses a comma or bracket before the "…".
 */
export function truncate(text: string, max: number, { atWord = false } = {}): string {
	if (text.length <= max) return text;
	const head = text.slice(0, max - 1);
	if (!atWord) return `${head.trimEnd()}…`;
	const space = head.lastIndexOf(' ');
	return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,.:;(–-]+$/, '')}…`;
}

/** A text as a pattern matches it literally. */
export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
