// The passage of a citing text a row of Verbonden shows under its line: the words that cite
// the bron marked, a few words before them and the rest of the sentence after (Thijs, 13 Oct:
// "de geciteerde tekst hier zien zodat ik niet heel hard moet zoeken").

export type Passage = { before: string; mark: string; after: string };

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
export function uitsnede(p: Passage): Passage {
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
	let after = p.after;
	if (after.length > NA) {
		const cut = after.lastIndexOf(' ', NA);
		after = `${after.slice(0, cut > 0 ? cut : NA)}…`;
	}
	return { before: before.replace(/^\s+/, ''), mark: p.mark, after: after.replace(/\s+$/, '') };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where a text cites an article: `artikel 3:2 van de Awb`, `art. 6:162 BW`, `artikel 12`. Only
 * for a text without the API's spans (a snippet on its own): a paragraph's spans say it exactly.
 * The law's names (`Awb`, `Algemene wet bestuursrecht`) are part of the marked words where
 * they follow; a citation that names one of them comes first, so an `artikel 12` of
 * another law is not taken for it. Null where the text names the article in other words.
 */
export function citeerplaats(
	text: string,
	number: string,
	laws: readonly string[] = []
): { start: number; end: number } | null {
	const nr = escape(number.trim());
	if (!nr) return null;
	const names = laws.filter((l) => l && l.trim()).map((l) => escape(l.trim()));
	const head = `\\b(?:[Aa]rtikel(?:en)?|[Aa]rt\\.)\\s*${nr}(?![\\w:]|\\.\\d)`;
	// A lid or onderdeel between the number and the law: `, eerste lid, van de Awb`.
	const tussen = `(?:,?\\s+(?:[^\\s,.;]+\\s+){0,4}?(?:lid|onder\\s+\\w+)\\b,?)?`;
	const law = names.length
		? `\\s+(?:van\\s+(?:de|het)\\s+)?(?:${names.join('|')})(?![\\w-])`
		: null;
	if (law) {
		const m = new RegExp(head + tussen + law).exec(text);
		if (m) return { start: m.index, end: m.index + m[0].length };
	}
	const m = new RegExp(head).exec(text);
	return m ? { start: m.index, end: m.index + m[0].length } : null;
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

/** What the detail of a judgment says of one article it cites. */
type Aangehaald = {
	article: {
		key: string;
		article_number?: string | null;
		instrument?: {
			abbreviation?: string | null;
			short_title?: string | null;
			citation_title?: string | null;
			title?: string | null;
		} | null;
	};
	paragraph_ids?: string[];
	snippet?: string | null;
	// The strongest mention's own place (API 0.79.54): read only where the API gives it.
	snippet_paragraph_id?: string | null;
	start?: number | null;
	end?: number | null;
	text?: string | null;
};

export type Aanhaling = { snippet: string; match: string | null; at: string | null };

const getal = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The words of a span in its paragraph, where its offsets hold them. */
function woordenVan(p: Alinea, c: Span): string | null {
	if (!getal(c.start) || !getal(c.end) || c.end <= c.start || c.end > p.text.length) return null;
	return p.text.slice(c.start, c.end);
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
	keys: readonly string[] = [cited.article.key]
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
			const match = woordenVan(p, c);
			if (match) return { snippet: p.text, match, at: id };
		}
		return null;
	};
	for (const id of ids.filter((i) => i.startsWith('rov-'))) {
		const a = inSpan(id);
		if (a) return a;
	}
	// The strongest mention as the API places it (0.79.54), where it gives the place.
	const eigen = cited.snippet_paragraph_id ? byId.get(cited.snippet_paragraph_id) : null;
	const woorden = eigen
		? woordenVan(eigen, { start: cited.start, end: cited.end, target: cited.article })
		: null;
	if (eigen && woorden) return { snippet: eigen.text, match: woorden, at: eigen.paragraph_id };
	for (const id of ids.filter((i) => !i.startsWith('rov-'))) {
		const a = inSpan(id);
		if (a) return a;
	}
	// Without a paragraph: the API's snippet, the words read from it as a citation names them.
	const snippet = cited.snippet?.trim();
	if (!snippet) return null;
	const number = cited.article.article_number;
	const i = cited.article.instrument;
	const laws = [i?.abbreviation, i?.short_title, i?.citation_title, i?.title].filter(
		(l): l is string => !!l
	);
	const at = number ? citeerplaats(snippet, number, laws) : null;
	return {
		snippet,
		match: cited.text?.trim() || (at ? snippet.slice(at.start, at.end) : null),
		at: cited.snippet_paragraph_id ?? ids[0] ?? null
	};
}
