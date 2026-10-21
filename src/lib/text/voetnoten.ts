// The footnotes of a judgment and of a Kamerstuk, as the readers set them: a marker (its
// label) at the place in the text that refers to the note, and the note under its
// overweging or paragraph, in the margin where there is room (Voetnoten.svelte). The notes
// of an article and a bijlage are lines of its own text, or notes of their own listed under
// it (`footnotes`), each marker a link to its note (ArticleText). Pure functions, no Svelte.
import { escapeRegExp, textOf } from '$lib/text/words';
import type { Schema } from '$lib/api/types';
import { formatAnchor, parseAnchor } from './anchor';

type Span = Schema<'ArticleCitationSpan'>;

/** A footnote as a reader shows it. `id` is unique in the bron and is its anchor (`fn-35`). */
export type Noot = {
	id: string;
	label: string;
	text: string;
	/** The citations in `text`, with their offsets in it: the same links as in a paragraph. */
	citations: Span[];
};

/** Where a marker stands: `at` in the text that refers to the note; null at its end. A marker
 *  of an article's note links to the note in the same text (`href`, `#fn-1`), and the first
 *  marker of a note is where the note links back to (`anchor`, `fnref-1`). */
export type NootMarker = {
	id: string;
	label: string;
	at: number | null;
	href?: string | null;
	anchor?: string | null;
};

/** A range to mark in a text: the words a verbinding names. */
export type Bereik = { start: number; end: number };

/** The anchor of a judgment's note by its label: `fn-35`; a second note with a label `fn-35-2`. */
export const nootAnker = (label: string) => formatAnchor({ kind: 'note', label });

/** Whether an anchor names a note: `fn-35`, `fn-3-2`. */
export const isNootAnker = (at: string | null | undefined): at is string =>
	!!at && parseAnchor(at)?.kind === 'note';

/**
 * The notes of a judgment (API 0.79.55): each by its anchor, and per paragraph the markers
 * that refer to them in its order. A note no paragraph refers to stands in `los`.
 */
export function uitspraakNoten(
	footnotes: readonly Schema<'JudgmentFootnote'>[] | null | undefined
): {
	noten: Map<string, Noot>;
	perAlinea: Map<string, NootMarker[]>;
	los: string[];
} {
	const noten = new Map<string, Noot>();
	const perAlinea = new Map<string, NootMarker[]>();
	const los: string[] = [];
	for (const f of footnotes ?? []) {
		if (!f.text?.trim()) continue;
		let id = nootAnker(f.label);
		for (let n = 2; noten.has(id); n++) id = `${nootAnker(f.label)}-${n}`;
		noten.set(id, { id, label: f.label, text: f.text, citations: f.citations ?? [] });
		if (!f.paragraph_id) {
			los.push(id);
			continue;
		}
		const of = perAlinea.get(f.paragraph_id) ?? [];
		of.push({ id, label: f.label, at: f.at ?? null });
		perAlinea.set(f.paragraph_id, of);
	}
	return { noten, perAlinea, los };
}

/** A paragraph of a Kamerstuk as the reader cuts its text: where it starts and its words. */
type Regel = { start: number; text: string };

/**
 * The notes of a Kamerstuk (API 0.79.55) placed in its paragraphs: a note with `at` gets a
 * marker in the paragraph that holds it (at its end where `at` falls between two); one
 * without, at the end of its section (`section_id`, the index of the section's last
 * paragraph), else at the end of the stuk (`los`).
 */
export function stukNoten(
	footnotes: readonly Schema<'DocumentFootnoteDTO'>[] | null | undefined,
	regels: readonly Regel[],
	secties: readonly { id: string; char_end: number }[]
): {
	noten: Map<string, Noot>;
	/** Per paragraph (its index), the markers in it, `at` relative to its text. */
	markers: Map<number, NootMarker[]>;
	/** Per paragraph (its index), the notes without a marker that close its section. */
	naSectie: Map<number, string[]>;
	los: string[];
} {
	const noten = new Map<string, Noot>();
	const markers = new Map<number, NootMarker[]>();
	const naSectie = new Map<number, string[]>();
	const los: string[] = [];
	const voeg = <T>(m: Map<number, T[]>, i: number, x: T) => m.set(i, [...(m.get(i) ?? []), x]);
	for (const f of footnotes ?? []) {
		if (!f.text?.trim()) continue;
		const a = parseAnchor(f.id);
		const label = f.label?.trim() || (a?.kind === 'note' ? a.label : f.id);
		noten.set(f.id, { id: f.id, label, text: f.text, citations: [] });
		if (f.at != null) {
			const i = regelVan(regels, f.at);
			if (i >= 0) {
				const r = regels[i];
				voeg(markers, i, {
					id: f.id,
					label,
					at: Math.max(0, Math.min(f.at - r.start, r.text.length))
				});
				continue;
			}
		}
		const sectie = f.section_id ? secties.find((s) => s.id === f.section_id) : null;
		const laatste = sectie ? regels.findLastIndex((r) => r.start < sectie.char_end) : -1;
		if (laatste >= 0) voeg(naSectie, laatste, f.id);
		else los.push(f.id);
	}
	return { noten, markers, naSectie, los };
}

/** The paragraph that holds `at`: the one it falls in, else the last before it. */
export function regelVan(regels: readonly Regel[], at: number): number {
	const binnen = regels.findIndex((r) => r.start <= at && at <= r.start + r.text.length);
	if (binnen >= 0) return binnen;
	return regels.findLastIndex((r) => r.start <= at);
}

/**
 * Where an edge of a Kamerstuk stands in it (`meta.place`, API 0.79.55): in a note
 * (`fn-71`, the words at `start`..`end` of its text), in the text (the section, the words at
 * `start`..`end` of the stuk's text) or in its title. Null for an edge without a place.
 */
type StukPlaats =
	| { part: 'footnote'; at: string; label: string | null; bereik: Bereik | null }
	| { part: 'text'; at: string | null; bereik: Bereik | null }
	| { part: 'title'; at: null; bereik: null };

const getal = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function stukPlaats(meta: Record<string, unknown> | null | undefined): StukPlaats | null {
	const p = meta?.place;
	if (!p || typeof p !== 'object') return null;
	const place = p as Record<string, unknown>;
	const bereik =
		getal(place.start) && getal(place.end) && place.end > place.start
			? { start: place.start, end: place.end }
			: null;
	if (place.part === 'footnote') {
		const id = textOf(place.footnote_id);
		return id ? { part: 'footnote', at: id, label: textOf(place.footnote), bereik } : null;
	}
	if (place.part === 'text') return { part: 'text', at: textOf(place.section_id), bereik };
	if (place.part === 'title') return { part: 'title', at: null, bereik: null };
	return null;
}

/** `voetnoot 35`: how a row and a card name a note. */
export const voetnootWoord = (label: string) => `voetnoot ${label}`;

/** `r.o. 5.7.6 (voetnoot 35)`: a place, and the note in it where the citation stands there. */
export const metVoetnoot = (plaats: string | null, label: string | null | undefined) =>
	label ? (plaats ? `${plaats} (${voetnootWoord(label)})` : voetnootWoord(label)) : plaats;

/** A marker as the API gives it; `footnote` since API 0.81 (absent before it). */
export type FootnoteMark = Omit<Schema<'FootnoteMarkDTO'>, 'footnote'> & {
	footnote?: number | null;
};

/**
 * A note of an article or a bijlage (API 0.80.2, a marker without `footnote`): a line of its text that opens with its
 * number (`1 Richtlijn (EU) 2019/944 …`), `start`..`end` the line, `body` where the words
 * after the number begin.
 */
type ArticleNote = {
	number: string;
	start: number;
	end: number;
	body: number;
	/** Its anchor, a judgment's note's: `fn-1`. */
	anchor: string;
};

/** The anchor of the first marker that refers to an article's note: `fnref-1`. */
export const markerAnchor = (number: string) => `fnref-${number}`;

/**
 * The notes the markers of a text refer to (`footnote_marks`): per number the first line
 * after its first marker that opens with that number and a space, outside the tables; else
 * the first such line anywhere. A number without such a line has no note: its marker stays
 * text.
 */
export function articleNotes(
	text: string,
	marks: readonly FootnoteMark[] | null | undefined,
	tables: readonly { start: number; end: number }[] = []
): Map<string, ArticleNote> {
	const out = new Map<string, ArticleNote>();
	const inTable = (at: number) => tables.some((t) => at >= t.start && at < t.end);
	for (const m of [...(marks ?? [])].sort((a, b) => a.at - b.at)) {
		// A marker of a footnote of its own (`footnote`) refers to no line of the text.
		if (m.footnote != null || out.has(m.number)) continue;
		const line = new RegExp(`(^|\\n)[ \\u00a0]*(${escapeRegExp(m.number)})[ \\u00a0]+\\S`, 'g');
		const found = [...text.matchAll(line)]
			.map((r) => r.index + r[0].indexOf(r[2], r[1].length))
			.filter((at) => !inTable(at));
		const start = found.find((at) => at >= m.at) ?? found[0];
		if (start === undefined) continue;
		const nl = text.indexOf('\n', start);
		const end = start + text.slice(start, nl < 0 ? undefined : nl).trimEnd().length;
		out.set(m.number, {
			number: m.number,
			start,
			end,
			body: start + m.number.length,
			anchor: nootAnker(m.number)
		});
	}
	return out;
}

type Footnote = Schema<'FootnoteDTO'>;

/**
 * A footnote the source writes where its marker stands (API 0.81, a BWB `<noot>`): not a
 * line of the text but its own (`footnotes`), shown in the list under the text. `index` is
 * its place in `footnotes`, the marker's `footnote`.
 */
type ListedNote = {
	index: number;
	number: string;
	text: string;
	/** Its anchor: `fn-1`; a second note with that number `fn-1-2`. */
	anchor: string;
	/** The anchor of its first marker, where it links back to; null for a note without one
	 *  (of the heading). */
	back: string | null;
	/** Where its first marker stands in the text; null without one. */
	at: number | null;
};

/**
 * The footnotes of a text in the order of `footnotes` (those without a marker first, as the
 * API gives them), each with its anchor and, where a marker refers to it, the anchor of its
 * first marker. `taken`: the anchors the notes in the text have already.
 */
export function listedNotes(
	footnotes: readonly Footnote[] | null | undefined,
	marks: readonly FootnoteMark[] | null | undefined,
	taken: Iterable<string> = []
): ListedNote[] {
	const used = new Set(taken);
	const first = new Map<number, number>();
	for (const m of [...(marks ?? [])].sort((a, b) => a.at - b.at))
		if (m.footnote != null && !first.has(m.footnote)) first.set(m.footnote, m.at);
	return (footnotes ?? []).flatMap((f, index) => {
		if (!f.text?.trim()) return [];
		const number = f.number.trim() || '_';
		// A number taken already gets its count: `1-2`, its note `fn-1-2`, its marker `fnref-1-2`.
		let label = number;
		for (let n = 2; used.has(nootAnker(label)); n++) label = `${number}-${n}`;
		const anchor = nootAnker(label);
		used.add(anchor);
		const at = first.get(index) ?? null;
		return [
			{
				index,
				number: f.number.trim(),
				text: f.text,
				anchor,
				back: at === null ? null : markerAnchor(label),
				at
			}
		];
	});
}

/**
 * The markers in `text[start, end]`, `at` relative to `start`: each a link to its note
 * where it has one and the text has anchors (`anchors`), the first of a number the place its
 * note links back to.
 */
export function articleMarkers(
	marks: readonly FootnoteMark[] | null | undefined,
	notes: ReadonlyMap<string, ArticleNote>,
	start: number,
	end: number,
	anchors: boolean,
	listed: readonly ListedNote[] = []
): NootMarker[] {
	const byIndex = new Map(listed.map((n) => [n.index, n]));
	const sorted = [...(marks ?? [])].sort((a, b) => a.at - b.at);
	const first = new Map<string, number>();
	for (const m of sorted) if (!first.has(m.number)) first.set(m.number, m.at);
	return sorted
		.filter((m) => m.at >= start && m.at <= end)
		.map((m) => {
			if (m.footnote != null) {
				const own = byIndex.get(m.footnote);
				return {
					id: own?.back ?? markerAnchor(m.number),
					label: m.number,
					at: m.at - start,
					href: own && anchors ? `#${own.anchor}` : null,
					anchor: own && anchors && own.at === m.at ? own.back : null
				};
			}
			const note = anchors ? notes.get(m.number) : undefined;
			return {
				id: markerAnchor(m.number),
				label: m.number,
				at: m.at - start,
				href: note ? `#${note.anchor}` : null,
				anchor: note && first.get(m.number) === m.at ? markerAnchor(m.number) : null
			};
		});
}

/**
 * Blocks of a text cut at the notes in them: each note a block of its own (`note`), the
 * text before and after it trimmed, none empty. A table or a heading is left as it is.
 */
export function withNotes<
	B extends { start: number; end: number; table?: unknown; heading?: boolean }
>(
	text: string,
	blocks: readonly B[],
	notes: ReadonlyMap<string, ArticleNote>
): (B & { note: ArticleNote | null })[] {
	const all = [...notes.values()].sort((a, b) => a.start - b.start);
	return blocks.flatMap((b) => {
		const inside =
			b.table || b.heading ? [] : all.filter((n) => n.start >= b.start && n.end <= b.end);
		if (!inside.length) return [{ ...b, note: null }];
		const out: (B & { note: ArticleNote | null })[] = [];
		const plain = (from: number, to: number) => {
			const raw = text.slice(from, to);
			const s = from + raw.length - raw.trimStart().length;
			const e = s + raw.trim().length;
			if (e > s) out.push({ ...b, start: s, end: e, note: null });
		};
		let at = b.start;
		for (const n of inside) {
			plain(at, n.start);
			out.push({ ...b, start: n.start, end: n.end, note: n });
			at = n.end;
		}
		plain(at, b.end);
		return out;
	});
}
