// A judgment as a lawyer cites it: the court in its usual short form, the date in full,
// then the ECLI. HR 19 juli 2019, ECLI:NL:HR:2019:1278; Rb. Den Haag 6 juli 2026, …;
// Hof Amsterdam 22 september 2026, ….
import { langeDatum } from './datum';

/** `2019-07-19` as `19 juli 2019`; null for anything else. */
const longDate = (day: string | null | undefined): string | null => langeDatum(day) || null;

/** The place of a rechtbank or gerechtshof from its name: `Rechtbank Den Haag` → `Den Haag`. */
const placeOf = (name: string | null | undefined, kind: 'Rechtbank' | 'Gerechtshof') =>
	new RegExp(`^${kind}\\s+(.+)$`, 'i').exec(name?.trim() ?? '')?.[1] ?? null;

/**
 * The court as it is cited, from the court code of the ECLI and, for a rechtbank or hof,
 * its place from the name: HR, Conclusie (the Parket), ABRvS, CRvB, CBb, Hof Amsterdam,
 * Rb. Den Haag, HvJ EU, EHRM.
 */
export function courtCite(ecli: string, courtName?: string | null): string {
	const [, country = '', code = ''] = ecli.trim().toUpperCase().split(':');
	if (country === 'CE' && code === 'ECHR') return 'EHRM';
	if (country === 'EU') return code === 'T' ? 'Gerecht EU' : 'HvJ EU';
	switch (code) {
		case 'HR':
			return 'HR';
		case 'PHR':
			return 'Conclusie';
		case 'RVS':
			return 'ABRvS';
		case 'CRVB':
			return 'CRvB';
		case 'CBB':
			return 'CBb';
	}
	if (code.startsWith('GH')) {
		const place = placeOf(courtName, 'Gerechtshof');
		return place ? `Hof ${place}` : 'Hof';
	}
	if (code.startsWith('RB')) {
		const place = placeOf(courtName, 'Rechtbank');
		return place ? `Rb. ${place}` : 'Rb.';
	}
	return courtName?.trim() || code;
}

/**
 * The advocate-general of a conclusion as a citation names them: `A-G Hartlief` from
 * `T. Hartlief` (the initials go), `P-G` where the signature says Procureur-Generaal.
 */
export function authorCite(
	name: string | null | undefined,
	signature: string[] = []
): string | null {
	const surname = (name ?? '')
		.trim()
		.split(/\s+/)
		.filter((part) => !/^([A-Z]\.)+$/.test(part) && !/^mr\.?$/i.test(part))
		.join(' ');
	if (!surname) return null;
	const pg = signature.some((line) => /^(p-g|procureur-generaal)$/i.test(line.trim()));
	return `${pg ? 'P-G' : 'A-G'} ${surname}`;
}

/**
 * `HR 19 juli 2019` and `HR 19 juli 2019, ECLI:NL:HR:2019:1278`; a conclusion with its
 * author: `Conclusie A-G Hartlief 8 mei 2020`.
 */
export function judgmentCite(
	ecli: string,
	date: string | null | undefined,
	courtName?: string | null,
	author?: string | null
): { short: string; full: string } {
	const when = longDate(date);
	const who = author ? `${courtCite(ecli, courtName)} ${author}` : courtCite(ecli, courtName);
	const short = when ? `${who} ${when}` : who;
	return { short, full: `${short}, ${ecli.trim().toUpperCase()}` };
}

/**
 * How a numbered paragraph is cited: `r.o. 3.1` (rechtsoverweging) in a Dutch judgment,
 * `onder 3.1` in a conclusion of the Parket, as the Hoge Raad refers to one, `§ 9` in a
 * judgment of the EHRM or the HvJ EU. Takes the ECLI or the key of the judgment
 * (`ecli_nl_phr_2020_453`).
 */
export function paragraphCite(ecli: string | null | undefined, number: string): string {
	const parts = (ecli ?? '').trim().toUpperCase().split(/[:_/]/);
	const at = parts.indexOf('ECLI');
	const [country = '', code = ''] = at < 0 ? [] : parts.slice(at + 1);
	if (country === 'CE' || country === 'EU') return `§ ${number}`;
	return code === 'PHR' ? `onder ${number}` : `r.o. ${number}`;
}
