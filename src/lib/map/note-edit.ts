// What the keys and the buttons of the note's field do to its text (B62): ⌘B and ⌘I put
// vet and cursief round the selection, or take them off; Kop, Opsomming, Genummerde lijst
// and Citaat put their sign before the lines, or take it off; Enter in a list goes on with
// the next point, and on an empty point ends the list. On the text and its selection alone.
import { lineOf } from './markup';

/** The text of the field and its selection. */
export type FieldState = { text: string; start: number; end: number };

export type LineSign = 'heading' | 'bullets' | 'numbered' | 'quote';

const SIGN: Record<Exclude<LineSign, 'numbered'>, string> = {
	heading: '# ',
	bullets: '- ',
	quote: '> '
};

/** Bold (`**`) or italic (`*`) round the selection; off where it is already round it. */
export function wrapSelection({ text, start, end }: FieldState, sign: '**' | '*'): FieldState {
	const n = sign.length;
	const before = text.slice(start - n, start);
	const after = text.slice(end, end + n);
	// `*` round a selection in `**…**` is the bold's, not an italic.
	const own = sign === '**' || (text[start - 2] !== '*' && text[end + 1] !== '*');
	if (before === sign && after === sign && own)
		return {
			text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n),
			start: start - n,
			end: end - n
		};
	return {
		text: text.slice(0, start) + sign + text.slice(start, end) + sign + text.slice(end),
		start: start + n,
		end: end + n
	};
}

/** Where the lines of a selection begin and end. */
function linesAround(text: string, start: number, end: number) {
	const from = text.lastIndexOf('\n', start - 1) + 1;
	const next = text.indexOf('\n', end);
	return { from, to: next < 0 ? text.length : next };
}

/**
 * The sign of a kind before every line of the selection, a list numbered on; where each
 * already has it, taken off. Another sign gives way to it.
 */
export function toggleLineSign({ text, start, end }: FieldState, kind: LineSign): FieldState {
	const { from, to } = linesAround(text, start, end);
	const lines = text.slice(from, to).split('\n');
	const off = lines.every((l) => lineOf(l).kind === kind);
	const block = lines
		.map((l, n) => {
			const parsed = lineOf(l);
			const rest = parsed.kind === 'empty' ? l : parsed.rest;
			if (off) return rest;
			return (kind === 'numbered' ? `${n + 1}. ` : SIGN[kind]) + rest;
		})
		.join('\n');
	const shift = block.length - (to - from);
	const changed = text.slice(0, from) + block + text.slice(to);
	// One line: the caret moves with its words; more: the lines stay selected.
	return lines.length === 1
		? { text: changed, start: Math.max(from, start + shift), end: Math.max(from, end + shift) }
		: { text: changed, start: from, end: from + block.length };
}

/**
 * Enter in a point of a list: a new line with the next point. On a point that holds
 * nothing, the point is taken off and the list ends there. Elsewhere null: a new line.
 */
export function continueList({ text, start, end }: FieldState): FieldState | null {
	if (start !== end) return null;
	const { from, to } = linesAround(text, start, start);
	const l = lineOf(text.slice(from, start));
	if (l.kind !== 'bullets' && l.kind !== 'numbered') return null;
	if (!l.rest.trim() && !text.slice(start, to).trim())
		return { text: text.slice(0, from) + text.slice(to), start: from, end: from };
	const insert = `\n${l.kind === 'numbered' ? `${(l.number ?? 0) + 1}. ` : l.sign}`;
	const caret = start + insert.length;
	return { text: text.slice(0, start) + insert + text.slice(start), start: caret, end: caret };
}

/** What changed between two texts: one range of the old and what takes its place. */
export function changeOf(old: string, next: string) {
	let from = 0;
	while (from < old.length && from < next.length && old[from] === next[from]) from++;
	let o = old.length;
	let n = next.length;
	while (o > from && n > from && old[o - 1] === next[n - 1]) {
		o--;
		n--;
	}
	return { from, to: o, text: next.slice(from, n) };
}
