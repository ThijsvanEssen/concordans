// The reader's own note in a little Markdown (B62): a kop (`# `), points (`- `), a numbered
// list (`1. `), a citaat (`> `), vet (`**…**`) and cursief (`*…*`); verwijzingen and web
// addresses become links. Nothing more: any other line is a line, as a note of before was
// (one Enter is a new line), and the text is kept as typed. The parse loses nothing, so the
// field shows the very characters typed, its signs dimmed (`segmentsOfLine`).
import { referencesIn, type NoteReference } from './references';

export type NoteInline =
	| { kind: 'text'; text: string }
	| { kind: 'bold'; parts: NoteInline[] }
	| { kind: 'italic'; parts: NoteInline[] }
	| { kind: 'reference'; text: string; ref: NoteReference }
	| { kind: 'url'; text: string };

type NoteBlock =
	| { kind: 'heading'; line: NoteInline[] }
	| { kind: 'paragraph' | 'quote'; lines: NoteInline[][] }
	| { kind: 'bullets'; items: NoteInline[][] }
	| { kind: 'numbered'; start: number; items: NoteInline[][] };

type LineKind = 'heading' | 'bullets' | 'numbered' | 'quote' | 'paragraph' | 'empty';

const SIGNS: [Exclude<LineKind, 'paragraph' | 'empty'>, RegExp][] = [
	['heading', /^#{1,3}\s+/],
	['bullets', /^[-*]\s+/],
	['numbered', /^(\d{1,3})[.)]\s+/],
	['quote', /^>\s?/]
];

/** A line by the sign it opens with: the sign as typed, the rest, a list's number. */
export function lineOf(line: string): {
	kind: LineKind;
	sign: string;
	rest: string;
	number?: number;
} {
	if (!line.trim()) return { kind: 'empty', sign: '', rest: line };
	for (const [kind, re] of SIGNS) {
		const m = re.exec(line);
		if (m)
			return {
				kind,
				sign: m[0],
				rest: line.slice(m[0].length),
				...(kind === 'numbered' ? { number: Number(m[1]) } : {})
			};
	}
	return { kind: 'paragraph', sign: '', rest: line };
}

const URL_RE = /\bhttps?:\/\/[^\s<>]*[^\s<>().,;:!?'"]/g;

/** Plain text with its verwijzingen and web addresses taken out as links. */
function links(text: string): NoteInline[] {
	const spans: { start: number; end: number; ref?: NoteReference }[] = [
		...referencesIn(text).map((r) => ({ start: r.start, end: r.end, ref: r })),
		...[...text.matchAll(URL_RE)].map((m) => ({ start: m.index, end: m.index + m[0].length }))
	].sort((a, b) => a.start - b.start);
	const out: NoteInline[] = [];
	let at = 0;
	for (const s of spans) {
		if (s.start < at) continue;
		if (s.start > at) out.push({ kind: 'text', text: text.slice(at, s.start) });
		const t = text.slice(s.start, s.end);
		out.push(s.ref ? { kind: 'reference', text: t, ref: s.ref } : { kind: 'url', text: t });
		at = s.end;
	}
	if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
	return out;
}

/** Where a single `*` closes what opened at `from`: not part of `**`, not after a space. */
function closingStar(s: string, from: number): number {
	for (let i = from; i < s.length; i++)
		if (s[i] === '*' && s[i + 1] !== '*' && s[i - 1] !== '*' && s[i - 1] !== ' ') return i;
	return -1;
}

/** The words of a line: bold and italic round text, verwijzingen and addresses in it. */
function inline(s: string): NoteInline[] {
	const out: NoteInline[] = [];
	let text = '';
	const flush = () => {
		if (text) out.push(...links(text));
		text = '';
	};
	let i = 0;
	while (i < s.length) {
		if (s.startsWith('**', i) && s[i + 2] && s[i + 2] !== ' ') {
			const end = s.indexOf('**', i + 2);
			if (end > i + 2 && s[end - 1] !== ' ') {
				flush();
				out.push({ kind: 'bold', parts: inline(s.slice(i + 2, end)) });
				i = end + 2;
				continue;
			}
		} else if (s[i] === '*' && s[i + 1] && s[i + 1] !== ' ' && s[i + 1] !== '*') {
			const end = closingStar(s, i + 1);
			if (end > i + 1) {
				flush();
				out.push({ kind: 'italic', parts: inline(s.slice(i + 1, end)) });
				i = end + 1;
				continue;
			}
		}
		text += s[i++];
	}
	flush();
	return out;
}

/** The note as blocks: lines of one kind together, a kop alone, an empty line between. */
export function noteBlocks(md: string): NoteBlock[] {
	const out: NoteBlock[] = [];
	let before: LineKind = 'empty';
	for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
		const l = lineOf(raw);
		const last = out[out.length - 1];
		const goesOn = last && before === l.kind && l.kind !== 'heading';
		const words = inline(l.rest);
		if (l.kind === 'empty') {
			// An empty line ends the block before it.
		} else if (l.kind === 'heading') out.push({ kind: 'heading', line: words });
		else if (goesOn && 'items' in last) last.items.push(words);
		else if (goesOn && 'lines' in last) last.lines.push(words);
		else if (l.kind === 'bullets') out.push({ kind: 'bullets', items: [words] });
		else if (l.kind === 'numbered')
			out.push({ kind: 'numbered', start: l.number ?? 1, items: [words] });
		else out.push({ kind: l.kind, lines: [words] });
		before = l.kind;
	}
	return out;
}

// ── In the field: the characters as typed ─────────────────────────────────

/** A piece of a line in the field: a sign (dimmed), a verwijzing (its dotted line), text. */
type NoteSegment = { kind: 'sign' | 'reference' | 'text'; text: string };

function segmentsOf(parts: NoteInline[]): NoteSegment[] {
	return parts.flatMap((d): NoteSegment[] => {
		if ('parts' in d) {
			const t = d.kind === 'bold' ? '**' : '*';
			return [{ kind: 'sign', text: t }, ...segmentsOf(d.parts), { kind: 'sign', text: t }];
		}
		return [{ kind: d.kind === 'reference' ? 'reference' : 'text', text: d.text }];
	});
}

/** A line of the field in its pieces; together exactly the line. */
export function segmentsOfLine(line: string): NoteSegment[] {
	const l = lineOf(line);
	if (l.kind === 'empty') return line ? [{ kind: 'text', text: line }] : [];
	return [
		...(l.sign ? [{ kind: 'sign' as const, text: l.sign }] : []),
		...segmentsOf(inline(l.rest))
	];
}

// ── Out of the bundel: plain text, HTML, one run of words ────────────────

const wordsOf = (parts: NoteInline[]): string =>
	parts.map((d) => ('parts' in d ? wordsOf(d.parts) : d.text)).join('');

/**
 * The note as plain text, for Citeer and the CSV: the signs gone, the form in lines. A kop
 * is its line, a list keeps its numbers or points, a citaat is indented between quotes.
 */
export function plainText(md: string): string {
	return noteBlocks(md)
		.map((b) => {
			if (b.kind === 'heading') return wordsOf(b.line);
			if (b.kind === 'bullets') return b.items.map((r) => `- ${wordsOf(r)}`).join('\n');
			if (b.kind === 'numbered')
				return b.items.map((r, n) => `${b.start + n}. ${wordsOf(r)}`).join('\n');
			if (b.kind === 'quote') return `    „${b.lines.map(wordsOf).join('\n    ')}"`;
			return b.lines.map(wordsOf).join('\n');
		})
		.join('\n\n');
}

/** The note as one run of words, for a card that holds no lines: points after a comma. */
export function asRun(md: string): NoteInline[] {
	const out: NoteInline[] = [];
	for (const b of noteBlocks(md)) {
		const lines = b.kind === 'heading' ? [b.line] : 'items' in b ? b.items : b.lines;
		lines.forEach((r, n) => {
			if (n && 'items' in b) out.push({ kind: 'text', text: ', ' });
			else if (out.length) out.push({ kind: 'text', text: ' ' });
			out.push(...r);
		});
	}
	return out;
}

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(parts: NoteInline[], href: (r: NoteReference) => string | null): string {
	return parts
		.map((d) => {
			if ('parts' in d) {
				const tag = d.kind === 'bold' ? 'strong' : 'em';
				return `<${tag}>${inlineHtml(d.parts, href)}</${tag}>`;
			}
			if (d.kind === 'text') return escape(d.text);
			const to = d.kind === 'url' ? d.text : href(d.ref);
			return to ? `<a href="${escape(to)}">${escape(d.text)}</a>` : escape(d.text);
		})
		.join('');
}

/** The note as HTML, for a word processor: kop, vet, lists and citaat kept, links absolute. */
export function noteHtml(md: string, href: (r: NoteReference) => string | null): string {
	const r = (parts: NoteInline[]) => inlineHtml(parts, href);
	const items = (rows: NoteInline[][]) => rows.map((i) => `<li>${r(i)}</li>`).join('');
	return noteBlocks(md)
		.map((b) => {
			if (b.kind === 'heading') return `<h3>${r(b.line)}</h3>`;
			if (b.kind === 'bullets') return `<ul>${items(b.items)}</ul>`;
			if (b.kind === 'numbered')
				return `<ol${b.start > 1 ? ` start="${b.start}"` : ''}>${items(b.items)}</ol>`;
			const body = b.lines.map(r).join('<br>');
			return b.kind === 'quote' ? `<blockquote>${body}</blockquote>` : `<p>${body}</p>`;
		})
		.join('');
}

/** Plain text as HTML: its paragraphs, its lines. */
export const linesHtml = (text: string): string =>
	text
		.split(/\n{2,}/)
		.map((p) => `<p>${escape(p).replaceAll('\n', '<br>')}</p>`)
		.join('');

/** The first line of a note that is no kop, without its signs: the bundel's question in a list. */
export function firstLine(md: string | null | undefined): string | null {
	for (const b of noteBlocks(md ?? '')) {
		if (b.kind === 'heading') continue;
		const t = wordsOf('items' in b ? b.items[0] : b.lines[0]).trim();
		if (t) return t;
	}
	return null;
}
