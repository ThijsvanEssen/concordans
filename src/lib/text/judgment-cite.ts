// A judgment as a lawyer cites it: the court in its usual short form, the date in full,
// then the ECLI. HR 19 juli 2019, ECLI:NL:HR:2019:1278; Rb. Den Haag 6 juli 2026, …;
// Hof Amsterdam 22 september 2026, ….

const MONTHS = [
	'januari',
	'februari',
	'maart',
	'april',
	'mei',
	'juni',
	'juli',
	'augustus',
	'september',
	'oktober',
	'november',
	'december'
];

/** `2019-07-19` as `19 juli 2019`; null for anything else. */
function longDate(day: string | null | undefined): string | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '');
	if (!m) return null;
	return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

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

/** `HR 19 juli 2019` and `HR 19 juli 2019, ECLI:NL:HR:2019:1278`. */
export function judgmentCite(
	ecli: string,
	date: string | null | undefined,
	courtName?: string | null
): { short: string; full: string } {
	const when = longDate(date);
	const short = when ? `${courtCite(ecli, courtName)} ${when}` : courtCite(ecli, courtName);
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
