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
 * Where a text cites an article: `artikel 3:2 van de Awb`, `art. 6:162 BW`, `artikel 12`.
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

/** A paragraph of a judgment as the detail gives it (`id` on prod, `paragraph_id` in the schema). */
type Alinea = { paragraph_id?: string; id?: string; number?: string | null; text: string };

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
};

const alineaId = (p: Alinea) => p.paragraph_id ?? p.id ?? (p.number ? `rov-${p.number}` : null);

/**
 * The passage of a judgment that cites an article, from the detail the reader loads: the
 * first of its paragraphs that names the article as a citation does, whole, with the cited
 * words; else the API's snippet of the strongest mention. `at` is the paragraph, for the
 * link that opens the reader there.
 */
export function aanhalingIn(
	cited: Aangehaald,
	paragraphs: readonly Alinea[]
): { snippet: string; match: string | null; at: string | null } | null {
	const number = cited.article.article_number;
	if (!number) return null;
	const i = cited.article.instrument;
	const laws = [i?.abbreviation, i?.short_title, i?.citation_title, i?.title].filter(
		(l): l is string => !!l
	);
	const byId = new Map(paragraphs.map((p) => [alineaId(p), p]));
	// A numbered overweging first: its r.o. is the link to it.
	const ids = cited.paragraph_ids ?? [];
	for (const id of [
		...ids.filter((i) => i.startsWith('rov-')),
		...ids.filter((i) => !i.startsWith('rov-'))
	]) {
		const p = byId.get(id);
		const at = p && citeerplaats(p.text, number, laws);
		if (p && at) return { snippet: p.text, match: p.text.slice(at.start, at.end), at: id };
	}
	const snippet = cited.snippet?.trim();
	if (!snippet) return null;
	const at = citeerplaats(snippet, number, laws);
	return {
		snippet,
		match: at ? snippet.slice(at.start, at.end) : null,
		at: ids[0] ?? null
	};
}
