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
 * judgment of the EHRM, `punt 45` in one of the courts of the EU, as the Court cites itself in
 * Dutch. Takes the ECLI or the key of the judgment (`ecli_nl_phr_2020_453`).
 */
export function paragraphCite(ecli: string | null | undefined, number: string): string {
	const { country, code } = courtOf(ecli);
	if (country === 'CE') return `§ ${number}`;
	if (country === 'EU') return `punt ${number}`;
	return code === 'PHR' ? `onder ${number}` : `r.o. ${number}`;
}

/** Whether a judgment is one of the courts of the EU (the Hof, the Gerecht), by its ECLI or key. */
export const isEuCourt = (ecli: string | null | undefined): boolean =>
	courtOf(ecli).country === 'EU';

/** Whether a judgment is a conclusion of the Parket bij de Hoge Raad, by its ECLI or key. */
export const isConclusion = (ecli: string | null | undefined): boolean =>
	courtOf(ecli).code === 'PHR';

/**
 * A judgment's node key from its ECLI, as the API makes it (`make_node_key`): every run of
 * other characters one underscore, `ecli_nl_hr_2019_2006`, and the dot too:
 * `ECLI:BE:CASS:2019:ARR.20190101.1` is `ecli_be_cass_2019_arr_20190101_1`.
 */
export const ecliKey = (ecli: string): string =>
	ecli
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^_+|_+$/g, '');
/** The ECLI back from a key; null where a dot made the key ambiguous (the props have it). */
export const keyEcli = (key: string) =>
	/^ecli_[a-z]{2}_[a-z0-9]+_\d{4}_[a-z0-9]+$/.test(key)
		? key.toUpperCase().replaceAll('_', ':')
		: null;
