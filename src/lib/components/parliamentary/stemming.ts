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

/** The seats (or members) for and against in a tally; a choice not in it counts none. */
export const forAgainst = (
	tally: Record<string, number> | null | undefined
): { voor: number; tegen: number } => ({
	voor: tally?.[CHOICE.for] ?? 0,
	tegen: tally?.[CHOICE.against] ?? 0
});
