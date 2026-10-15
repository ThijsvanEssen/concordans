// The footnotes of a judgment and of a Kamerstuk, as the readers set them: a marker (its
// label) at the place in the text that refers to the note, and the note under its
// overweging or paragraph, in the margin where there is room (Voetnoten.svelte). Pure
// functions, no Svelte.
import { textOf } from '$lib/text/words';
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

/** Where a marker stands: `at` in the text that refers to the note; null at its end. */
export type NootMarker = { id: string; label: string; at: number | null };

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
