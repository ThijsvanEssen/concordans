import { dossierLabel, type DossierNaamBron } from '$lib/bron/dossier-naam';

// The name of a stemming in a list, where its title is a link and cannot be empty. The
// subject comes first; without one, the dossier it was held in, by number and name; without
// that, the plain fact.
export function stemmingNaam(
	subject: string | null | undefined,
	dossier?: DossierNaamBron | string | null
): string {
	if (subject?.trim()) return subject;
	if (dossier)
		return `Stemming over ${dossierLabel(typeof dossier === 'string' ? { number: dossier } : dossier)}`;
	return 'Stemming, onderwerp niet in de gegevens';
}

/** The two choices of a stemming as the API counts them, in the order they are said. */
export const CHOICE = { for: 'Voor', against: 'Tegen' } as const;
const CHOICE_ORDER: readonly string[] = [CHOICE.for, CHOICE.against];

/** Voor first, then Tegen, then any other choice. */
export const choiceRank = (choice: string): number => {
	const i = CHOICE_ORDER.indexOf(choice);
	return i < 0 ? CHOICE_ORDER.length : i;
};

const seats = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The seats (or members) for and against in a tally, as the API gives it or as a node's
 * props carry it; a choice not in it counts none.
 */
export const forAgainst = (tally: unknown): { voor: number; tegen: number } => {
	const t = (tally && typeof tally === 'object' ? tally : {}) as Record<string, unknown>;
	return { voor: seats(t[CHOICE.for]), tegen: seats(t[CHOICE.against]) };
};

/** Whether a tally counts a seat for or against; seats of 0 are unknown, not a tally. */
export const hasVotes = (tally: unknown): boolean => {
	const { voor, tegen } = forAgainst(tally);
	return voor + tegen > 0;
};

/** `141 voor, 7 tegen` (or with `en` between them); null for a tally without seats. */
export function votesSentence(tally: unknown, between: ', ' | ' en ' = ', '): string | null {
	const { voor, tegen } = forAgainst(tally);
	return voor + tegen > 0 ? `${voor} voor${between}${tegen} tegen` : null;
}

/** `139–11`; null for a tally without seats. */
export function votesShort(tally: unknown): string | null {
	const { voor, tegen } = forAgainst(tally);
	return voor + tegen > 0 ? `${voor}–${tegen}` : null;
}
