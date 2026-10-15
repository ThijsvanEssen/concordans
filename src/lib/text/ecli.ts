// What an ECLI tells by itself: the country and court code, and so how its paragraphs are
// cited. The judgment itself is cited as the API cites it (`cite`, judgment-cite.ts).

/** The country and court code of an ECLI, its key (`ecli_nl_phr_2020_453`) or its node id. */
function courtOf(ecli: string | null | undefined): { country: string; code: string } {
	const parts = (ecli ?? '').trim().toUpperCase().split(/[:_/]/);
	const at = parts.indexOf('ECLI');
	const [country = '', code = ''] = at < 0 ? [] : parts.slice(at + 1);
	return { country, code };
}

/**
 * How a numbered paragraph is cited: `r.o. 3.1` (rechtsoverweging) in a Dutch judgment,
 * `onder 3.1` in a conclusion of the Parket, as the Hoge Raad refers to one, `§ 9` in a
 * judgment of the EHRM or the HvJ EU. Takes the ECLI or the key of the judgment
 * (`ecli_nl_phr_2020_453`).
 */
export function paragraphCite(ecli: string | null | undefined, number: string): string {
	const { country, code } = courtOf(ecli);
	if (country === 'CE' || country === 'EU') return `§ ${number}`;
	return code === 'PHR' ? `onder ${number}` : `r.o. ${number}`;
}

/** Whether a judgment is a conclusion of the Parket bij de Hoge Raad, by its ECLI or key. */
export const isConclusion = (ecli: string | null | undefined): boolean =>
	courtOf(ecli).code === 'PHR';
