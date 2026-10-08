// A dossier by its number and the name a reader knows it by: "36496 Wet betaalbare huur".
// The number stays in front, as Kamerstukken are cited by it; the name follows from official
// data only (Thijs, 9 Oct: "dossiernummers zijn prima, maar ik heb liever ook human-readable
// namen"). Where a response carries only the number, the name comes later and on its own:
// asked per number, once, two at a time, never on the way to a first paint.
import { api, unwrap } from '$lib/api/client';
import { once } from '$lib/api/records';

export type DossierNaamBron = {
	number: string;
	title?: string | null;
	short_title?: string | null;
	short_title_basis?: 'title' | 'citation' | 'case' | 'amended_law' | null;
};

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

/** "36889 wijziging van Archiefwet 1995"; the number alone where no name is known. */
export function dossierLabel(d: DossierNaamBron): string {
	const name = dossierName(d);
	return name === d.number ? d.number : `${d.number} ${name}`;
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
