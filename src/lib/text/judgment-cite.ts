// A judgment as a lawyer cites it: the court in its usual short form, the date in full,
// then the ECLI. HR 19 juli 2019, ECLI:NL:HR:2019:1278; Rb. Den Haag 6 juli 2026, …;
// Hof Amsterdam 22 september 2026, ….
import { textOf } from './words';
import { langeDatum } from './datum';
import { courtName as nameOfCourt } from './court';
import { bewaarItem, type MapItem } from '$lib/map/map';

/** `2019-07-19` as `19 juli 2019`; null for anything else. */
const longDate = (day: string | null | undefined): string | null => langeDatum(day) || null;

/** The place of a rechtbank or gerechtshof from its name: `Rechtbank Den Haag` → `Den Haag`. */
const placeOf = (name: string | null | undefined, kind: 'Rechtbank' | 'Gerechtshof') =>
	new RegExp(`^${kind}\\s+(.+)$`, 'i').exec(name?.trim() ?? '')?.[1] ?? null;

/**
 * The court as it is cited, from the court code of the ECLI and, for a rechtbank or hof,
 * its place from the name (given, or that of the code): HR, Conclusie (the Parket), ABRvS, CRvB, CBb, Hof Amsterdam,
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
	const name = nameOfCourt(courtName) ?? nameOfCourt(code);
	if (code.startsWith('GH')) {
		const place = placeOf(name, 'Gerechtshof');
		return place ? `Hof ${place}` : 'Hof';
	}
	if (code.startsWith('RB')) {
		const place = placeOf(name, 'Rechtbank');
		return place ? `Rb. ${place}` : 'Rb.';
	}
	return name ?? code;
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
 * A conclusion as an arrest's status line names it, from the judgment's own detail
 * (`conclusions`, API 0.79.43): "P-G Langemeijer en Wissink, 13 september 2019". The role
 * says A-G or P-G; one the graph lacks is its ECLI alone.
 */
export function conclusieNaam(c: {
	ecli: string;
	author?: string | null;
	role?: string | null;
	date?: string | null;
}): string {
	const wie = authorCite(
		c.author,
		/procureur-generaal/i.test(c.role ?? '') ? ['procureur-generaal'] : []
	);
	if (!wie) return c.ecli.trim().toUpperCase();
	const wanneer = longDate(c.date);
	return wanneer ? `${wie}, ${wanneer}` : wie;
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
	const { country, code } = courtOf(ecli);
	if (country === 'CE' || country === 'EU') return `§ ${number}`;
	return code === 'PHR' ? `onder ${number}` : `r.o. ${number}`;
}

/** The country and court code of an ECLI, its key (`ecli_nl_phr_2020_453`) or its node id. */
function courtOf(ecli: string | null | undefined): { country: string; code: string } {
	const parts = (ecli ?? '').trim().toUpperCase().split(/[:_/]/);
	const at = parts.indexOf('ECLI');
	const [country = '', code = ''] = at < 0 ? [] : parts.slice(at + 1);
	return { country, code };
}

/** Whether a judgment is a conclusion of the Parket bij de Hoge Raad, by its ECLI or key. */
export const isConclusion = (ecli: string | null | undefined): boolean =>
	courtOf(ecli).code === 'PHR';

/** What a judgment's detail gives to cite it and its overwegingen. */
export type UitspraakVoorCitaat = {
	ecli?: string | null;
	props?: Record<string, unknown> | null;
	advocate_general?: string | null;
	/** Procureur-Generaal where the A-G signed as one (API 0.74). */
	advocate_general_role?: string | null;
	paragraphs?: { kind?: string | null; text: string }[] | null;
	names?: string[] | null;
	/** Its reader's address, for the link to an overweging. */
	path?: string | null;
};

/** The judgment as its heading cites it (HR 19 juli 2019, …), or null without an ECLI. */
export function uitspraakKop(j: UitspraakVoorCitaat): { short: string; full: string } | null {
	if (!j.ecli) return null;
	// The A-G of a conclusion, as it is cited: Conclusie A-G Hartlief 8 mei 2020.
	const author = authorCite(j.advocate_general, [
		...(j.paragraphs ?? []).filter((p) => p.kind === 'signature').map((p) => p.text),
		...(j.advocate_general_role ? [j.advocate_general_role] : [])
	]);
	return judgmentCite(j.ecli, textOf(j.props?.date), textOf(j.props?.court), author);
}

/** A judgment as Gemarkeerd groups under it: as its heading cites it, with its names. */
export const zaakNaam = (kort: string, namen: string[] | null | undefined) =>
	namen?.length ? `${kort} (${namen.join(', ')})` : kort;

/**
 * An overweging as its menu cites and keeps it: kort and voluit with `r.o. 3.1`, the link to
 * its place, and the item Bewaar keeps (with the bron's id). The reader and a map's item
 * (MapInhoud) offer the same menu from it. Null without an ECLI.
 */
export function overwegingCitaat(
	j: UitspraakVoorCitaat,
	num: string,
	anker: string,
	link: string,
	bronId: string | null
): {
	kort: string;
	voluit: string;
	link: string;
	bewaar: MapItem | null;
} | null {
	const kop = uitspraakKop(j);
	if (!kop || !j.ecli) return null;
	const at = paragraphCite(j.ecli, num);
	const kort = `${kop.short}, ${at}`;
	const voluit = `${kop.full}, ${at}`;
	return {
		kort,
		voluit,
		link,
		bewaar: bronId
			? bewaarItem(bronId, { at: anker, kort, voluit }, { groep: zaakNaam(kop.short, j.names) })
			: null
	};
}
