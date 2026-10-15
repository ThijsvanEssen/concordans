// The passage of a citing text a row of Verbonden shows under its line: the words that cite
// the bron marked, a few words before them and the rest of the sentence after (Thijs, 13 Oct:
// "de geciteerde tekst hier zien zodat ik niet heel hard moet zoeken").
import { truncate } from '$lib/text/words';
import { paragraphNumber } from '$lib/text/anchor';

export type PassageParts = { before: string; mark: string; after: string };

/** Characters before the marked words where the sentence starts earlier. */
const VOOR = 60;
/** Characters after them: two or three lines of the row, the clamp cuts the rest. */
const NA = 240;

const OPEN = /[.;:!?]\s+(?=[A-Z[(‘“"'])/g;

/**
 * The passage around its mark, cut to what a row shows: from the start of the sentence
 * that holds the mark where that is near, else from a word boundary, with an ellipsis; and
 * as far after it.
 */
export function uitsnede(p: PassageParts): PassageParts {
	let before = p.before;
	if (before.length > VOOR) {
		const tail = before.slice(-VOOR);
		let start = -1;
		for (const m of tail.matchAll(OPEN)) start = m.index + m[0].length;
		if (start >= 0) before = tail.slice(start);
		else {
			const space = tail.indexOf(' ');
			before = `…${tail.slice(space + 1)}`;
		}
	}
	const after = truncate(p.after, NA, { atWord: true });
	return { before: before.replace(/^\s+/, ''), mark: p.mark, after: after.replace(/\s+$/, '') };
}

/** A citation the API found in a paragraph: its offsets in the paragraph's text, its target. */
type Span = { start?: number | null; end?: number | null; target: { key: string } };

/** A paragraph of a judgment as the detail gives it, with the citations the API found in it. */
type Alinea = {
	paragraph_id: string;
	number?: string | null;
	text: string;
	citations?: readonly Span[] | null;
};

/** What the detail of a judgment says of one article or judgment it cites. */
type Aangehaald = {
	article?: { key: string };
	paragraph_ids?: string[];
	/** The text around the strongest mention; `text` stands in it at `start`..`end`. */
	snippet?: string | null;
	/** The paragraph the snippet is from (of a footnote: the paragraph that refers to it). */
	snippet_paragraph_id?: string | null;
	start?: number | null;
	end?: number | null;
	text?: string | null;
	/** The label of the note the strongest mention stands in (API 0.79.55). */
	footnote?: string | null;
};

export type Aanhaling = {
	snippet: string;
	match: string | null;
	at: string | null;
	/** The label of the note the words stand in; null in the paragraph itself. */
	noot: string | null;
};

const getal = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The words at `start`..`end` of a text, where the offsets hold them. */
function woordenIn(text: string, start: unknown, end: unknown): string | null {
	if (!getal(start) || !getal(end) || start < 0 || end <= start || end > text.length) return null;
	return text.slice(start, end);
}

/**
 * The strongest mention as the API places it: its snippet with the words at its offsets, or
 * its `text` where the judgment was normalized again since it was linked (no offsets).
 */
function sterkste(cited: Aangehaald): { snippet: string; match: string | null } | null {
	const snippet = cited.snippet;
	if (!snippet?.trim()) return null;
	const words = cited.text?.trim() || null;
	const match =
		woordenIn(snippet, cited.start, cited.end) ?? (words && snippet.includes(words) ? words : null);
	return { snippet, match };
}

/**
 * The passage of a judgment that cites an article, from the detail the reader loads: the
 * first of its paragraphs whose citations the API found point at the article (a numbered
 * overweging first: its r.o. is the link to it), whole, with the words of that citation.
 * Where no paragraph holds such a span, the API's own place of the strongest mention, then
 * its snippet. `keys` are the article's keys (a stub's and the article's own); `at` is the
 * paragraph, for the link that opens the reader there.
 */
export function aanhalingIn(
	cited: Aangehaald,
	paragraphs: readonly Alinea[],
	keys: readonly string[] = cited.article ? [cited.article.key] : []
): Aanhaling | null {
	const doelen = new Set(keys);
	const byId = new Map(paragraphs.map((p) => [p.paragraph_id, p]));
	const ids = cited.paragraph_ids?.length
		? cited.paragraph_ids
		: paragraphs.map((p) => p.paragraph_id);
	const inSpan = (id: string): Aanhaling | null => {
		const p = byId.get(id);
		if (!p) return null;
		for (const c of p.citations ?? []) {
			if (!doelen.has(c.target.key)) continue;
			const match = woordenIn(p.text, c.start, c.end);
			if (match) return { snippet: p.text, match, at: id, noot: null };
		}
		return null;
	};
	for (const id of ids.filter((i) => paragraphNumber(i) !== null)) {
		const a = inSpan(id);
		if (a) return a;
	}
	// The strongest mention in its paragraph, where the API names it: the whole paragraph
	// where the snippet is part of it, else the snippet (of a footnote) with the paragraph.
	const eigen = sterkste(cited);
	const noot = cited.footnote?.trim() || null;
	const alinea = cited.snippet_paragraph_id ? byId.get(cited.snippet_paragraph_id) : null;
	if (eigen?.match && alinea) {
		const heel = !noot && alinea.text.includes(eigen.snippet.trim());
		return {
			snippet: heel ? alinea.text : eigen.snippet,
			match: eigen.match,
			at: alinea.paragraph_id,
			noot
		};
	}
	for (const id of ids.filter((i) => paragraphNumber(i) === null)) {
		const a = inSpan(id);
		if (a) return a;
	}
	// Without a paragraph: the API's snippet with its words.
	if (!eigen) return null;
	return { ...eigen, at: cited.snippet_paragraph_id ?? ids[0] ?? null, noot };
}
