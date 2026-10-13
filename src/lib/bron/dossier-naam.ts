// A dossier by its number and the name a reader knows it by: "Kamerstuk 36496 Wet betaalbare
// huur". The number stays in front, as Kamerstukken are cited by it, and never stands bare:
// "Kamerstuk 36496" is what tells a dossier from the wet of the same name (Thijs, 13 Oct: "een
// duidelijk onderscheid tussen wet en gelijknamig dossier"). The name follows from official
// data only (Thijs, 9 Oct: "dossiernummers zijn prima, maar ik heb liever ook human-readable
// namen"). Where a response carries only the number, or no short title, the name comes later
// and on its own: asked per number, once, two at a time, never on the way to a first paint.
import { api, unwrap } from '$lib/api/client';
import { once } from '$lib/api/records';

export type DossierNaamBron = {
	number: string;
	title?: string | null;
	/** Null: the API knows none. Left out: the response does not carry it (it is asked). */
	short_title?: string | null;
	short_title_basis?: 'title' | 'citation' | 'case' | 'amended_law' | null;
};

/**
 * The kind of a dossier with its number, the one wording for it everywhere: `Kamerstuk 36764`,
 * `Kamerstuk I 36764` for the Eerste Kamer. A stuk in it follows after a comma.
 */
export const kamerstukNummer = (number: string, kamer?: 'EK' | 'TK' | null) =>
	`Kamerstuk${kamer === 'EK' ? ' I' : ''} ${number}`;

/** Whether the data on hand says what the short title is (also where it says there is none). */
export const kentKorteNaam = (d: DossierNaamBron) => d.short_title !== undefined;

/**
 * A dossier from the props of a node or a row: its number (`label`, else `number`), its title
 * without the API's "Kamerstukdossier 36764: " in front, and its short title where the props
 * carry one.
 */
export function dossierUitProps(
	props: Record<string, unknown> | null | undefined,
	fallback = ''
): DossierNaamBron {
	const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
	const p = props ?? {};
	const number = t(p.label) ?? t(p.number) ?? fallback;
	const title = (t(p.title) ?? t(p.display_name))?.replace(/^Kamerstukdossier\s+[^:]+:\s*/, '');
	const d: DossierNaamBron = { number, title: title ?? null };
	if ('short_title' in p) d.short_title = t(p.short_title);
	const basis = t(p.short_title_basis);
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
 * reads the name from its brackets); the number without a title.
 */
export function dossierName(d: DossierNaamBron): string {
	const short = d.short_title?.trim();
	if (short) return d.short_title_basis === 'amended_law' ? `wijziging van ${short}` : short;
	const title = d.title?.trim();
	if (!title) return d.number;
	return title.length > NAAM_MAX ? `${title.slice(0, NAAM_MAX - 1).trimEnd()}…` : title;
}

/** "Kamerstuk 36889 wijziging van Archiefwet 1995"; "Kamerstuk 36889" where no name is known. */
export function dossierLabel(d: DossierNaamBron): string {
	const name = dossierName(d);
	const nummer = kamerstukNummer(d.number);
	return name === d.number ? nummer : `${nummer} ${name}`;
}

// ── Only a number ───────────────────────────────────────────────────────────

const PARALLEL = 2;
let bezig = 0;
const wacht: (() => void)[] = [];
const beurt = () =>
	new Promise<void>((klaar) => {
		if (bezig < PARALLEL) {
			bezig++;
			klaar();
		} else wacht.push(klaar);
	});
const klaar = () => {
	const volgende = wacht.shift();
	if (volgende) volgende();
	else bezig--;
};

/**
 * The name of a dossier known only by its number, null where the data has none. One request
 * per number for the whole visit, two at a time (the API's limit per visitor).
 */
export function naamVanNummer(number: string): Promise<string | null> {
	const nr = number.trim();
	return once(`dossier-naam/${nr.toLowerCase()}`, async () => {
		await beurt();
		try {
			const r = await unwrap(
				api.GET('/api/dossiers', { params: { query: { number: nr, status: 'all', limit: 5 } } })
			);
			const d = r.items.find((x) => x.number?.toLowerCase() === nr.toLowerCase());
			if (!d) return null;
			const naam = dossierName({ ...d, number: nr });
			return naam === nr ? null : naam;
		} catch {
			return null;
		} finally {
			klaar();
		}
	});
}
