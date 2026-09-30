// The Kamerstuk a paper is: its own dossier and its number there (API 0.63). A dossier's
// timeline also holds papers of another dossier (in 31746 stands 31058, nr. 11), so the
// number alone would name the wrong Kamerstuk.

export type Kamerstuk = {
	dossier: string;
	/** `11` in the Tweede Kamer, a letter (`A`) in the Eerste Kamer. */
	number: string;
	/** Of another dossier than the one whose timeline it stands in. */
	elsewhere: boolean;
};

/**
 * A paper's Kamerstuk, or null for a paper that is none (an Eindtekst). An older paper
 * without its own dossier yet (until the full build) is taken to be of the dossier it stands
 * in: no other number is guessed.
 */
export function kamerstukOf(
	paper: { sequence?: string | number | null; dossier_number?: string | null },
	page: string | null | undefined
): Kamerstuk | null {
	const number = paper.sequence != null ? String(paper.sequence).trim() : '';
	const dossier = paper.dossier_number?.trim() || page || '';
	if (!number || !dossier) return null;
	return { dossier, number, elsewhere: !!page && dossier !== page };
}

/** `31058, nr. 11`; the Eerste Kamer numbers by letter, without `nr.`: `36901, A`. */
export const kamerstukNumber = (k: Kamerstuk, chamber?: string | null): string =>
	chamber === 'EK' ? `${k.dossier}, ${k.number}` : `${k.dossier}, nr. ${k.number}`;

const LEAD = /^(?:Kamerstuk|TK|EK)\s+[\w()-]+,\s*nr\.\s*[\w-]+\s*[.:]\s*/i;

/** A title without the Kamerstuk the API puts before it, where that is shown on its own. */
export const withoutKamerstuk = (title: string): string => title.replace(LEAD, '') || title;
