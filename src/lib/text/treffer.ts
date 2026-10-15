// The words a reader follows or searched for, found in a text by the rule the API finds them
// with (lawgraph `_words.word_pattern`): from the start of a word, in any case; a word of up
// to four characters whole (`AI` in `AI-verordening`, not in `universitaire`). One rule for
// Gevolgd, Actueel's `q` and the mark that shows where a row was found.
import { escapeRegExp } from './words';

/** Up to this length a word is an abbreviation (`AI`, `PFAS`): it has to stand whole. */
export const KORT = 4;

/** A word as it is matched: trimmed, its spaces one. */
export const normaal = (term: string) => term.trim().replace(/\s+/g, ' ');

const LETTER = '[\\p{L}\\p{N}]';

/** The pattern of one word, starting where a word starts; global, for every place. */
function patroon(term: string): RegExp | null {
	const woord = normaal(term);
	if (!woord) return null;
	const begin = /^[\p{L}\p{N}]/u.test(woord) ? `(?<!${LETTER})` : '';
	const eind = woord.length <= KORT && /[\p{L}\p{N}]$/u.test(woord) ? `(?!${LETTER})` : '';
	return new RegExp(`${begin}${escapeRegExp(woord)}${eind}`, 'giu');
}

/** A piece of a text, the words found in it marked. */
export type Deel = { tekst: string; mark: boolean };

/**
 * The text in pieces, each place one of `termen` starts marked as far as the word reaches;
 * null where none of them is in it. Overlapping places become one mark.
 */
export function markeer(
	termen: readonly string[],
	tekst: string | null | undefined
): Deel[] | null {
	if (!tekst) return null;
	const plekken: [number, number][] = [];
	for (const term of termen) {
		const p = patroon(term);
		if (!p) continue;
		for (const m of tekst.matchAll(p)) plekken.push([m.index, m.index + m[0].length]);
	}
	if (!plekken.length) return null;
	plekken.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
	const delen: Deel[] = [];
	let tot = 0;
	for (const [van, eind] of plekken) {
		if (eind <= tot) continue;
		const begin = Math.max(van, tot);
		if (begin > tot) delen.push({ tekst: tekst.slice(tot, begin), mark: false });
		const vorige = delen.at(-1);
		if (vorige?.mark && begin === tot) vorige.tekst += tekst.slice(begin, eind);
		else delen.push({ tekst: tekst.slice(begin, eind), mark: true });
		tot = eind;
	}
	if (tot < tekst.length) delen.push({ tekst: tekst.slice(tot), mark: false });
	return delen;
}

/** Characters on each side of the first mark in an excerpt. */
const RUIMTE = 48;

/**
 * The part of a long text around the first word found, cut at a word with an ellipsis on
 * the side that goes on: `… horizontale cyberbeveiligingsvereisten voor producten …`. Null
 * where none of `termen` is in it. The whole text where it is short.
 */
export function rondTreffer(
	termen: readonly string[],
	tekst: string | null | undefined,
	ruimte = RUIMTE
): Deel[] | null {
	const t = tekst?.replace(/\s+/g, ' ').trim();
	const delen = markeer(termen, t);
	if (!t || !delen) return null;
	const eerste = delen.findIndex((d) => d.mark);
	const van = delen.slice(0, eerste).reduce((n, d) => n + d.tekst.length, 0);
	const tot = van + delen[eerste].tekst.length;
	let begin = Math.max(0, van - ruimte);
	let eind = Math.min(t.length, tot + ruimte);
	// At a word: past the first space of a cut start, before the last space of a cut end.
	if (begin > 0) {
		const spatie = t.indexOf(' ', begin);
		begin = spatie >= 0 && spatie < van ? spatie + 1 : van;
	}
	if (eind < t.length) {
		const spatie = t.lastIndexOf(' ', eind);
		eind = spatie > tot ? spatie : tot;
	}
	const stuk = markeer(termen, t.slice(begin, eind).trim())!;
	if (begin > 0) stuk.unshift({ tekst: '… ', mark: false });
	if (eind < t.length) stuk.push({ tekst: ' …', mark: false });
	return stuk;
}
