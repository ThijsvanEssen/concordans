// The reader's own note in a little Markdown (B62): a kop (`# `), points (`- `), a numbered
// list (`1. `), a citaat (`> `), vet (`**…**`) and cursief (`*…*`); verwijzingen and web
// addresses become links. Nothing more: any other line is a line, as a note of before was
// (one Enter is a new line), and the text is kept as typed. The parse loses nothing, so the
// field shows the very characters typed, its signs dimmed (`segmenten`).
import { verwijzingenIn, type Verwijzing } from './verwijzingen';

export type Inline =
	| { soort: 'tekst'; tekst: string }
	| { soort: 'vet' | 'cursief'; delen: Inline[] }
	| { soort: 'verwijzing'; tekst: string; verwijzing: Verwijzing }
	| { soort: 'url'; tekst: string };

export type Blok =
	| { soort: 'kop'; regel: Inline[] }
	| { soort: 'alinea'; regels: Inline[][] }
	| { soort: 'opsomming'; items: Inline[][] }
	| { soort: 'lijst'; start: number; items: Inline[][] }
	| { soort: 'citaat'; regels: Inline[][] };

type RegelSoort = 'kop' | 'opsomming' | 'lijst' | 'citaat' | 'alinea' | 'leeg';

/** A line by the sign it opens with, the sign as typed and the rest. */
export type Regel = { soort: RegelSoort; teken: string; rest: string; nummer?: number };

const TEKENS: [Exclude<RegelSoort, 'alinea' | 'leeg'>, RegExp][] = [
	['kop', /^#{1,3}\s+/],
	['opsomming', /^[-*]\s+/],
	['lijst', /^(\d{1,3})[.)]\s+/],
	['citaat', /^>\s?/]
];

export function regel(line: string): Regel {
	if (!line.trim()) return { soort: 'leeg', teken: '', rest: line };
	for (const [soort, re] of TEKENS) {
		const m = re.exec(line);
		if (m)
			return {
				soort,
				teken: m[0],
				rest: line.slice(m[0].length),
				...(soort === 'lijst' ? { nummer: Number(m[1]) } : {})
			};
	}
	return { soort: 'alinea', teken: '', rest: line };
}

const URL_RE = /\bhttps?:\/\/[^\s<>]*[^\s<>().,;:!?'"]/g;

/** Plain text with its verwijzingen and web addresses taken out as links. */
function links(text: string): Inline[] {
	const spans = [
		...verwijzingenIn(text).map((v) => ({ start: v.start, eind: v.eind, verwijzing: v })),
		...[...text.matchAll(URL_RE)].map((m) => ({ start: m.index, eind: m.index + m[0].length }))
	].sort((a, b) => a.start - b.start);
	const uit: Inline[] = [];
	let at = 0;
	for (const s of spans) {
		if (s.start < at) continue;
		if (s.start > at) uit.push({ soort: 'tekst', tekst: text.slice(at, s.start) });
		const tekst = text.slice(s.start, s.eind);
		uit.push(
			'verwijzing' in s
				? { soort: 'verwijzing', tekst, verwijzing: s.verwijzing }
				: { soort: 'url', tekst }
		);
		at = s.eind;
	}
	if (at < text.length) uit.push({ soort: 'tekst', tekst: text.slice(at) });
	return uit;
}

/** Where a single `*` closes what opened at `from`: not part of `**`, not after a space. */
function sluitCursief(s: string, from: number): number {
	for (let i = from; i < s.length; i++)
		if (s[i] === '*' && s[i + 1] !== '*' && s[i - 1] !== '*' && s[i - 1] !== ' ') return i;
	return -1;
}

/** The words of a line: vet and cursief around text, verwijzingen and addresses in it. */
export function inline(s: string): Inline[] {
	const uit: Inline[] = [];
	let tekst = '';
	const flush = () => {
		if (tekst) uit.push(...links(tekst));
		tekst = '';
	};
	let i = 0;
	while (i < s.length) {
		if (s.startsWith('**', i) && s[i + 2] && s[i + 2] !== ' ') {
			const end = s.indexOf('**', i + 2);
			if (end > i + 2 && s[end - 1] !== ' ') {
				flush();
				uit.push({ soort: 'vet', delen: inline(s.slice(i + 2, end)) });
				i = end + 2;
				continue;
			}
		} else if (s[i] === '*' && s[i + 1] && s[i + 1] !== ' ' && s[i + 1] !== '*') {
			const end = sluitCursief(s, i + 1);
			if (end > i + 1) {
				flush();
				uit.push({ soort: 'cursief', delen: inline(s.slice(i + 1, end)) });
				i = end + 1;
				continue;
			}
		}
		tekst += s[i++];
	}
	flush();
	return uit;
}

/** The note as blocks: lines of one kind together, a kop alone, an empty line between. */
export function blokken(md: string): Blok[] {
	const uit: Blok[] = [];
	let vorige: RegelSoort = 'leeg';
	for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
		const r = regel(line);
		const laatste = uit[uit.length - 1];
		const verder = laatste && vorige === r.soort && r.soort !== 'kop';
		const woorden = inline(r.rest);
		if (r.soort === 'leeg') {
			// An empty line ends the block before it.
		} else if (r.soort === 'kop') uit.push({ soort: 'kop', regel: woorden });
		else if (verder && (laatste.soort === 'opsomming' || laatste.soort === 'lijst'))
			laatste.items.push(woorden);
		else if (verder && (laatste.soort === 'alinea' || laatste.soort === 'citaat'))
			laatste.regels.push(woorden);
		else if (r.soort === 'opsomming') uit.push({ soort: 'opsomming', items: [woorden] });
		else if (r.soort === 'lijst')
			uit.push({ soort: 'lijst', start: r.nummer ?? 1, items: [woorden] });
		else uit.push({ soort: r.soort, regels: [woorden] });
		vorige = r.soort;
	}
	return uit;
}

// ── In the field: the characters as typed ─────────────────────────────────

/** A piece of a line in the field: a sign (dimmed), a verwijzing (its dotted line), text. */
export type Segment = { soort: 'teken' | 'verwijzing' | 'tekst'; tekst: string };

function segmentsOf(delen: Inline[]): Segment[] {
	return delen.flatMap((d): Segment[] => {
		if ('delen' in d) {
			const t = d.soort === 'vet' ? '**' : '*';
			return [{ soort: 'teken', tekst: t }, ...segmentsOf(d.delen), { soort: 'teken', tekst: t }];
		}
		return [{ soort: d.soort === 'verwijzing' ? 'verwijzing' : 'tekst', tekst: d.tekst }];
	});
}

/** A line of the field in its pieces; together exactly the line. */
export function segmenten(line: string): Segment[] {
	const r = regel(line);
	if (r.soort === 'leeg') return line ? [{ soort: 'tekst', tekst: line }] : [];
	return [
		...(r.teken ? [{ soort: 'teken' as const, tekst: r.teken }] : []),
		...segmentsOf(inline(r.rest))
	];
}

// ── Out of the bundel: plain text, HTML, one run of words ────────────────

const woorden = (delen: Inline[]): string =>
	delen.map((d) => ('delen' in d ? woorden(d.delen) : d.tekst)).join('');

/**
 * The note as plain text, for Citeer and the CSV: the signs gone, the form in lines. A kop
 * is its line, a list keeps its numbers or points, a citaat is indented between quotes.
 */
export function platteTekst(md: string): string {
	return blokken(md)
		.map((b) => {
			if (b.soort === 'kop') return woorden(b.regel);
			if (b.soort === 'opsomming') return b.items.map((r) => `- ${woorden(r)}`).join('\n');
			if (b.soort === 'lijst')
				return b.items.map((r, n) => `${b.start + n}. ${woorden(r)}`).join('\n');
			if (b.soort === 'citaat') return `    „${b.regels.map(woorden).join('\n    ')}"`;
			return b.regels.map(woorden).join('\n');
		})
		.join('\n\n');
}

/** The note as one run of words, for a card that holds no lines: points after a colon. */
export function alsRegels(md: string): Inline[] {
	const uit: Inline[] = [];
	const spatie = () => uit.length && uit.push({ soort: 'tekst', tekst: ' ' });
	for (const b of blokken(md)) {
		const regels = b.soort === 'kop' ? [b.regel] : 'items' in b ? b.items : b.regels;
		regels.forEach((r, n) => {
			if (n && 'items' in b) uit.push({ soort: 'tekst', tekst: ', ' });
			else spatie();
			uit.push(...r);
		});
	}
	return uit;
}

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlInline(delen: Inline[], pad: (v: Verwijzing) => string | null): string {
	return delen
		.map((d) => {
			if ('delen' in d) {
				const tag = d.soort === 'vet' ? 'strong' : 'em';
				return `<${tag}>${htmlInline(d.delen, pad)}</${tag}>`;
			}
			if (d.soort === 'tekst') return escape(d.tekst);
			const href = d.soort === 'url' ? d.tekst : pad(d.verwijzing);
			return href ? `<a href="${escape(href)}">${escape(d.tekst)}</a>` : escape(d.tekst);
		})
		.join('');
}

/** The note as HTML, for a word processor: kop, vet, lists and citaat kept, links absolute. */
export function htmlVan(md: string, pad: (v: Verwijzing) => string | null): string {
	const r = (delen: Inline[]) => htmlInline(delen, pad);
	return blokken(md)
		.map((b) => {
			if (b.soort === 'kop') return `<h3>${r(b.regel)}</h3>`;
			if (b.soort === 'opsomming')
				return `<ul>${b.items.map((i) => `<li>${r(i)}</li>`).join('')}</ul>`;
			if (b.soort === 'lijst')
				return `<ol${b.start === 1 ? '' : ` start="${b.start}"`}>${b.items.map((i) => `<li>${r(i)}</li>`).join('')}</ol>`;
			const inhoud = b.regels.map(r).join('<br>');
			return b.soort === 'citaat' ? `<blockquote>${inhoud}</blockquote>` : `<p>${inhoud}</p>`;
		})
		.join('');
}

/** The first line of a note that is no kop, without its signs: the bundel's question in a list. */
export function eersteRegel(md: string | null | undefined): string | null {
	for (const b of blokken(md ?? '')) {
		if (b.soort === 'kop') continue;
		const eerste = 'items' in b ? b.items[0] : b.regels[0];
		const t = woorden(eerste).trim();
		if (t) return t;
	}
	return null;
}
