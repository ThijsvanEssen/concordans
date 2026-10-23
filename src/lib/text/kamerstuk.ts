// The Kamerstuk a paper is: its own dossier and its number there (API 0.63). A dossier's
// timeline also holds papers of another dossier (in 31746 stands 31058, nr. 11), so the
// number alone would name the wrong Kamerstuk.
import { kamerstukNummer, officialNumber } from '$lib/bron/dossier-naam';

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

/**
 * The vergaderjaar of a day (`2016-12-12` → `2016-2017`), as the source writes it: it opens
 * on Prinsjesdag, the third Tuesday of September (art. 65 Gw). Null for no day.
 */
export function sessionYearOn(date: string | null | undefined): string | null {
	const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	const year = Number(m[1]);
	const firstOfSeptember = new Date(Date.UTC(year, 8, 1)).getUTCDay();
	const prinsjesdag = 1 + ((2 - firstOfSeptember + 7) % 7) + 14;
	const month = Number(m[2]);
	const opened = month > 9 || (month === 9 && Number(m[3]) >= prinsjesdag);
	const from = opened ? year : year - 1;
	return `${from}-${from + 1}`;
}

export type Paper = {
	chamber?: string | null;
	session_year?: string | null;
	/** Its date: its vergaderjaar where the API does not name it (`explained-by`). */
	date?: string | null;
	dossier_number?: string | null;
	dossier_suffix?: string | null;
	/** `5` in the Tweede Kamer, a letter (`C`) in the Eerste Kamer. */
	number?: string | number | null;
	/** Several papers of one dossier at once, in order: `nrs. 3–5`, in the Eerste Kamer `A, B`. */
	numbers?: string[] | null;
};

/** `36945 IV`: the dossier with its suffix, as a citation writes it. */
const dossierOf = (p: Paper & { dossier_number: string }) =>
	p.dossier_suffix ? `${p.dossier_number} ${p.dossier_suffix}` : officialNumber(p.dossier_number);

/** `nr. 5`, `nrs. 3–5`; the Eerste Kamer's letters bare: `C`, `A, B`. */
function numbersOf(p: Paper): string | null {
	const ns = p.numbers?.length ? p.numbers : p.number == null || p.number === '' ? [] : [p.number];
	if (!ns.length) return null;
	if (p.chamber === 'EK') return ns.join(', ');
	return ns.length === 1 ? `nr. ${ns[0]}` : `nrs. ${ns[0]}–${ns.at(-1)}`;
}

/** `36791, C` or `36945 IV, nr. 5`: a paper's place in its dossier; null for no Kamerstuk. */
export function kamerstukLabel(p: Paper): string | null {
	const numbers = numbersOf(p);
	if (!p.dossier_number || !numbers) return null;
	return `${dossierOf({ ...p, dossier_number: p.dossier_number })}, ${numbers}`;
}

/**
 * `Kamerstuk 36945 IV, nr. 5` or `Kamerstuk I 36791, C`: a paper by its place, the dossier
 * alone where it has no number; null without a dossier.
 */
export function kamerstukName(p: Paper): string | null {
	if (!p.dossier_number) return null;
	const place = kamerstukLabel(p) ?? dossierOf({ ...p, dossier_number: p.dossier_number });
	return kamerstukNummer(place, p.chamber === 'EK' ? 'EK' : null);
}

/**
 * A paper as it is cited: `Kamerstukken I 2025/26, 36791, C` or `Kamerstukken II 2025/26,
 * 36791, nr. 5`. Null for a paper that is no Kamerstuk (a sprekerslijst, an antwoord).
 */
export function kamerstukCitation(p: Paper): string | null {
	const label = kamerstukLabel(p);
	if (!label) return null;
	const year = sessionYear(p.session_year ?? sessionYearOn(p.date));
	return `Kamerstukken ${p.chamber === 'EK' ? 'I' : 'II'}${year ? ` ${year}` : ''}, ${label}`;
}

// `Kamerstuk 36901, nr. 6.`, `Kamerstuk I 36600 VIII, AB:` (API 0.72: the Eerste Kamer's letter
// without `nr.`), and before 0.72 `EK 36901, nr. A:`.
const LEAD =
	/^(?:(?:Kamerstuk|Dossier)(?:\s+I{1,2})?|TK|EK)\s+[\w()-]+(?:\s+[A-Z]+)?,\s*(?:nr\.\s*)?[\w-]+\s*[.:]\s*/;

/** A title without the Kamerstuk the API puts before it, where that is shown on its own. */
export const withoutKamerstuk = (title: string): string => title.replace(LEAD, '') || title;
