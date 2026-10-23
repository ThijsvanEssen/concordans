// A dossier by its number and the name a reader knows it by: "Dossier 36496 Wet betaalbare
// huur". The number stays in front, as Kamerstukken are cited by it, and never stands bare:
// "Dossier 36496" is what tells a dossier from the wet of the same name (Thijs, 13 Oct: "een
// duidelijk onderscheid tussen wet en gelijknamig dossier"). The name follows from official
// data only (Thijs, 9 Oct: "dossiernummers zijn prima, maar ik heb liever ook human-readable
// namen"). The responses carry the short title (API 0.79.54); without one the title, cut.
import { textOf, truncate } from '$lib/text/words';

export type DossierNaamBron = {
	number: string;
	title?: string | null;
	/** Null or left out: the API knows none. */
	short_title?: string | null;
	short_title_basis?: 'title' | 'citation' | 'case' | 'amended_law' | null;
};

// `36600-VIII`, `23908-(R1519)`: a number and its suffix as the data and the URLs join them. A
// digit after the hyphen (`21501-20`) is part of the number, and is cited so.
const JOINED_SUFFIX = /^(\d+)-([A-Z]+|\([A-Z0-9]+\))$/i;

/**
 * A dossier number as a citation writes it, its suffix after a space: `36600 VIII`,
 * `23908 (R1519)`; `21501-20` stays. For the text a reader sees, never for a URL or a key.
 */
export const officialNumber = (number: string) => number.replace(JOINED_SUFFIX, '$1 $2');

/**
 * A dossier number with its suffix as a citation writes it (Handleiding Kamerstukken): a
 * numeric suffix, a subdossier, after a hyphen (`21501-20`), a roman one or a letter after a
 * space (`36600 VIII`). The one place that joins them (E9 K).
 */
export const dossierNumberText = (number: string, suffix?: string | null) =>
	suffix
		? /^\d+$/.test(suffix)
			? `${number}-${suffix}`
			: `${number} ${suffix}`
		: officialNumber(number);

/**
 * The kind of a dossier with its number, the one wording for it everywhere: `Dossier 36764`,
 * `Dossier I 36764` for the Eerste Kamer. A stuk in it follows after a comma.
 */
export const kamerstukNummer = (number: string, kamer?: 'EK' | 'TK' | null) =>
	`Dossier${kamer === 'EK' ? ' I' : ''} ${officialNumber(number)}`;

/**
 * A dossier's number as the Kamer writes it, with its suffix: "36600-VII", the one way to read
 * it from props. The source gives it as `label`; else `number` and `suffix` apart ("36600",
 * "VII"); `number` alone dropped the suffix (UX-toets 10 Oct: "Over 36600 Vaststelling van de
 * begrotingsstaten …" for 36600-VII). `fallback` where the props have none.
 */
export function dossierNummer(
	props: Record<string, unknown> | null | undefined,
	fallback: string | null = null
): string | null {
	const label = textOf(props?.label);
	if (label) return label;
	const nummer = textOf(props?.number);
	const suffix = textOf(props?.suffix);
	return nummer ? (suffix ? `${nummer}-${suffix}` : nummer) : fallback;
}

/**
 * A dossier from the props of a node or a row: its number (dossierNummer), its title without
 * the API's "Kamerstukdossier 36764: " in front, and its short title where the props carry
 * one.
 */
export function dossierUitProps(
	props: Record<string, unknown> | null | undefined,
	fallback = ''
): DossierNaamBron {
	const p = props ?? {};
	const number = dossierNummer(p, fallback) ?? fallback;
	const title = (textOf(p.title) ?? textOf(p.display_name))?.replace(
		/^Kamerstukdossier\s+[^:]+:\s*/,
		''
	);
	const d: DossierNaamBron = { number, title: title ?? null };
	if ('short_title' in p) d.short_title = textOf(p.short_title);
	const basis = textOf(p.short_title_basis);
	if (basis) d.short_title_basis = basis as DossierNaamBron['short_title_basis'];
	return d;
}

/** The long title, where it says more than the name: for a hover or a subtitle. */
export function dossierVolledigeTitel(d: DossierNaamBron, naam = dossierName(d)): string | null {
	const title = d.title?.trim();
	return title && title !== naam ? title : null;
}

/** Past this length a dossier without a short title is named by its title, cut. */
const NAAM_MAX = 80;

/**
 * The name alone: the API's short title, or where that is the law the bill amends
 * (`amended_law`) `wijziging van {wet}`; else the title, cut, without parsing it (the API
 * reads the name from its brackets). Null where the data knows no name.
 */
export function dossierOwnName(d: DossierNaamBron): string | null {
	const short = d.short_title?.trim();
	if (short) return d.short_title_basis === 'amended_law' ? `wijziging van ${short}` : short;
	const title = d.title?.trim();
	return title ? truncate(title, NAAM_MAX) : null;
}

/** The name alone, the number in its official notation where no name is known. */
export const dossierName = (d: DossierNaamBron): string =>
	dossierOwnName(d) ?? officialNumber(d.number);

/** "Dossier 36889 wijziging van Archiefwet 1995"; "Dossier 36889" where no name is known. */
export function dossierLabel(d: DossierNaamBron): string {
	const name = dossierOwnName(d);
	const nummer = kamerstukNummer(d.number);
	return name ? `${nummer} ${name}` : nummer;
}
