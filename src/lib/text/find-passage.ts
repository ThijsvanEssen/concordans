// TODO(backend B4, B5): nothing maps an article to the passage of a memorie van
// toelichting that explains it. This looks for the heading of the artikelsgewijze
// toelichting in the plain text. When the API delivers `passages`, this is a lookup.

export type Passage = {
	start: number;
	end: number;
	/** A text match, not a fact of the source. */
	derived: true;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A heading is a short line; a sentence that happens to start with "Artikel 107" is not. */
const MAX_HEADING = 140;

/**
 * The first heading-like line for the article: "Artikel 287", "Artikel 1.1.3 [...]",
 * or a heading of the amending law that names it ("Artikel I, onderdeel C (artikel 287)").
 */
export function findPassage(text: string, articleNumber: string): Passage | null {
	const number = escape(articleNumber.trim());
	if (!text || !number) return null;
	const own = new RegExp(`^[ \\t]*artikel[ \\t]+${number}(?![\\w.:])[^\\n]*$`, 'gim');
	const amending = new RegExp(
		`^[ \\t]*(?:artikel[ \\t]+[IVXLC]+|onderde(?:el|len)[ \\t]+[A-Z]+)\\b[^\\n]*\\bartikel(?:en)?[ \\t]+(?:[^\\n]*?[ ,])?${number}(?![\\w.:])[^\\n]*$`,
		'gim'
	);
	for (const pattern of [own, amending]) {
		for (const m of text.matchAll(pattern)) {
			const line = m[0].trim();
			if (line.length > MAX_HEADING) continue;
			const start = m.index + m[0].indexOf(line);
			return { start, end: start + line.length, derived: true };
		}
	}
	return null;
}
