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

/** `2025-2026` as a citation writes the vergaderjaar: `2025/26`. */
export function sessionYear(value: string | null | undefined): string | null {
	const m = value?.trim().match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
	return m ? `${m[1]}/${m[2].slice(-2)}` : null;
}

type Paper = {
	chamber?: string | null;
	session_year?: string | null;
	dossier_number?: string | null;
	dossier_suffix?: string | null;
	number?: string | null;
};

/** `36791, C` or `36945 IV, nr. 5`: a paper's place in its dossier; null for no Kamerstuk. */
export function kamerstukLabel(p: Paper): string | null {
	if (!p.dossier_number || !p.number) return null;
	const dossier = p.dossier_suffix ? `${p.dossier_number} ${p.dossier_suffix}` : p.dossier_number;
	return p.chamber === 'EK' ? `${dossier}, ${p.number}` : `${dossier}, nr. ${p.number}`;
}

/**
 * A paper as it is cited: `Kamerstukken I 2025/26, 36791, C` or `Kamerstukken II 2025/26,
 * 36791, nr. 5`. Null for a paper that is no Kamerstuk (a sprekerslijst, an antwoord).
 */
export function kamerstukCitation(p: Paper): string | null {
	const label = kamerstukLabel(p);
	if (!label) return null;
	const year = sessionYear(p.session_year);
	return `Kamerstukken ${p.chamber === 'EK' ? 'I' : 'II'}${year ? ` ${year}` : ''}, ${label}`;
}

// `Kamerstuk 36901, nr. 6.`, `Kamerstuk I 36600 VIII, AB:` (API 0.72: the Eerste Kamer's letter
// without `nr.`), and before 0.72 `EK 36901, nr. A:`.
const LEAD =
	/^(?:Kamerstuk(?:\s+I{1,2})?|TK|EK)\s+[\w()-]+(?:\s+[A-Z]+)?,\s*(?:nr\.\s*)?[\w-]+\s*[.:]\s*/;

/** A title without the Kamerstuk the API puts before it, where that is shown on its own. */
export const withoutKamerstuk = (title: string): string => title.replace(LEAD, '') || title;
