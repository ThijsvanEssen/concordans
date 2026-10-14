// One span of text that cites several articles, as the API gives it: one citation per
// article over the same span ("art. 2 en 8 EVRM", 224–240, to art. 2 and to art. 8). Read
// as one link it opened art. 2 only (UX-toets 10 Oct, #27). Split on the numbers in the
// text: "art. 2" to the first, "8" to the second; the words between and after stay text.
import { escapeRegExp } from './words';

type Doel = { article_number?: string | null };

export type Deel<T> = { van: number; tot: number; span: T | null };

/** A number as the text writes it, a BW book before it or not ("162" in "6:162"). */
const patroon = (nummer: string) =>
	new RegExp(`(?<![\\w:.])(?:\\d+[a-z]?:)?${escapeRegExp(nummer)}(?![\\w:])`, 'i');

/**
 * The parts of a span cited by several articles, offsets relative to the span's text; null
 * where a number cannot be found in it, and the span stays one link.
 */
export function splitsOpNummers<T extends { target: Doel }>(
	tekst: string,
	spans: readonly T[]
): Deel<T>[] | null {
	// In the order of the text, which need not be the API's: by where each number stands.
	const plek = (span: T) => {
		const nummer = span.target.article_number?.trim();
		if (!nummer) return -1;
		const m = patroon(nummer).exec(tekst);
		return m ? m.index : -1;
	};
	if (spans.some((s) => plek(s) < 0)) return null;
	const geordend = [...spans].sort((a, b) => plek(a) - plek(b));
	const delen: Deel<T>[] = [];
	let vanaf = 0;
	for (const [i, span] of geordend.entries()) {
		const nummer = span.target.article_number?.trim();
		if (!nummer) return null;
		const re = new RegExp(patroon(nummer).source, 'gi');
		re.lastIndex = vanaf;
		const m = re.exec(tekst);
		if (!m) return null;
		// The first link takes the words before its number ("art. 2"); a later one its number.
		const van = i === 0 ? 0 : m.index;
		if (van > vanaf) delen.push({ van: vanaf, tot: van, span: null });
		delen.push({ van, tot: m.index + m[0].length, span });
		vanaf = m.index + m[0].length;
	}
	if (vanaf < tekst.length) delen.push({ van: vanaf, tot: tekst.length, span: null });
	return delen;
}
