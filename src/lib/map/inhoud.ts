// What an item of a map shows when it opens (MapInhoud): the place it keeps, read in place.
// An article its lid, the article around it a click further; a judgment its overweging, the
// overwegingen around it a click further; a Kamerstuk the words its note quotes, in the text
// around them, else the opening of its text.
import { paragraphAnchor } from '$lib/text/anchor';
import type { BodyItem } from '$lib/components/explore/readers/judgment-text';

/** The words a note quotes ("…", “…”), where it quotes at least a few words. */
export function citaatUit(notitie: string | null | undefined): string | null {
	const m = /["“„]([^"“”„]{20,})["”]/.exec(notitie ?? '');
	return m ? m[1].trim() : null;
}

const plat = (s: string) => s.replace(/\s+/g, ' ');
/** Quotes and apostrophes as one sign each, so a note typed with straight ones finds curly ones. */
const vergelijk = (s: string) =>
	plat(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”„]/g, '"');

/**
 * The quoted words in the text around them: up to `rand` characters before and after, cut at
 * a word. Null where the text does not hold them.
 */
export function rondCitaat(
	tekst: string | null | undefined,
	citaat: string,
	rand = 320
): { voor: string; citaat: string; na: string } | null {
	const t = plat(tekst ?? '');
	const i = vergelijk(t).indexOf(vergelijk(citaat).trim());
	if (!t || i < 0) return null;
	const eind = i + plat(citaat).trim().length;
	let voor = t.slice(Math.max(0, i - rand), i);
	let na = t.slice(eind, eind + rand);
	if (i > rand) voor = `…${voor.slice(voor.indexOf(' ') + 1)}`;
	if (eind + rand < t.length) na = `${na.slice(0, na.lastIndexOf(' '))}…`;
	return { voor, citaat: t.slice(i, eind), na };
}

/** How many items before and after an overweging show its context. */
const ROND = 3;

/**
 * The items of a judgment's body that show the overweging an item keeps (`rov-5.7.1`): it,
 * its sub-overwegingen and the paragraphs that continue it; with `rond`, a few items before
 * and after. Null where the judgment has no such overweging.
 */
export function overwegingVan(
	items: BodyItem[],
	at: string,
	rond = false
): { items: BodyItem[]; eigen: Set<number> } | null {
	const begin = items.findIndex(
		(i) => i.kind === 'rov' && (i.id === at || paragraphAnchor(i.num) === at)
	);
	if (begin < 0) return null;
	const num = (items[begin] as { num: string }).num;
	let eind = begin + 1;
	while (eind < items.length) {
		const i = items[eind];
		if (i.kind === 'prose' && i.within) eind++;
		else if (i.kind === 'rov' && i.num.startsWith(`${num}.`)) eind++;
		else break;
	}
	const van = rond ? Math.max(0, begin - ROND) : begin;
	const tot = rond ? Math.min(items.length, eind + ROND) : eind;
	const eigen = new Set<number>();
	for (let k = begin; k < eind; k++) eigen.add(k - van);
	return { items: items.slice(van, tot), eigen };
}
