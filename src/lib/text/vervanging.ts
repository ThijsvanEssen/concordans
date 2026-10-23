// The chain of an amended amendment or motion on the page of the stuk itself: what it replaces
// ("ter vervanging van nr. 10") and what replaced it, as the API gives them on the document
// (`replaces`, `replaced_by`, from REVISES with the rule `vervanging`). Only the direct step:
// a stuk replaced twice over names the one that replaced it, not the end of the chain. Nothing
// is read from a title.
import { separatorBefore } from '$lib/text/words';

type Ref = { id: string; key: string; sequence?: number | null };
type Keten = { replaces?: readonly Ref[] | null; replaced_by?: readonly Ref[] | null };

/** A stuk the phrase names: its key, and its number as the source gives it. */
export type Nr = { key: string; nummer: string };

/** One phrase of the status line: "Vervangt nrs. 26 en 38", "Vervangen door nr. 47". */
export type Replacement = { woord: 'Vervangt' | 'Vervangen door'; nrs: Nr[] };

const isGenummerd = (r: unknown): r is { key: string; sequence: number } =>
	!!r && typeof (r as Ref).key === 'string' && typeof (r as Ref).sequence === 'number';

/** The numbered stukken of a list, lowest first; a stuk without a number is left out. */
export const numbered = (refs: unknown): Nr[] =>
	(Array.isArray(refs) ? refs : [])
		.filter(isGenummerd)
		.sort((a, b) => a.sequence - b.sequence)
		.map((r) => ({ key: r.key, nummer: String(r.sequence) }));

/** The phrases of the chain: what the stuk replaces, then what replaced it. */
export function replacementsOf(doc: Keten): Replacement[] {
	const zinnen: Replacement[] = [];
	const vervangt = numbered(doc.replaces);
	if (vervangt.length) zinnen.push({ woord: 'Vervangt', nrs: vervangt });
	const door = numbered(doc.replaced_by);
	if (door.length) zinnen.push({ woord: 'Vervangen door', nrs: door });
	return zinnen;
}

/** "nr." before one number, "nrs." before more. */
export const numberWord = (nrs: readonly Nr[]) => (nrs.length > 1 ? 'nrs.' : 'nr.');

/** The numbers as plain words: "nr. 10", "nrs. 26, 30 en 38". */
export const numbersText = (nrs: readonly Nr[]) =>
	`${numberWord(nrs)} ${nrs.map((n, i) => separatorBefore(i, nrs.length) + n.nummer).join('')}`;

/** A replaced stuk was not voted on as itself: its vote, if any, is that of what replaced it. */
export const hasOwnOutcome = (doc: Keten) => !(doc.replaced_by ?? []).length;
