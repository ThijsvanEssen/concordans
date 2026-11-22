// Indeling (B140): the rechtbank and the gerechtshof of a municipality, as the CBS gives them,
// with the article of the Wet op de rechterlijke indeling (RI) that draws each. Pure helpers
// of the page: the names, the groups per arrondissement, the search of a municipality.
import { padHref } from '$lib/bron/address';
import { listPath } from '$lib/bron/lists';
import { queryHref } from '$lib/util/address';
import type { Schema } from '$lib/api/types';

export type Map = Schema<'CourtDistrictsDTO'>;
export type Gemeente = Schema<'CourtDistrictDTO'>;
type Area = Schema<'CourtAreaDTO'>;

/** The Wet op de rechterlijke indeling. */
export const RI = 'BWBR0002080';

/** The rechtbank of an arrondissement as the CBS names it (`Noord-Holland`). */
export const rechtbankName = (area: Area): string =>
	/^rechtbank\b/i.test(area.name) ? area.name : `Rechtbank ${area.name}`;

/** The gerechtshof of a ressort, whether the CBS names it `Amsterdam` or `Gerechtshof Amsterdam`. */
export const hofName = (area: Area): string =>
	/^gerechtshof\b/i.test(area.name) ? area.name : `Gerechtshof ${area.name}`;

/** The ECLI code of each rechtbank and gerechtshof, by the name the CBS gives its area (`Noord-Holland`, `Arnhem-Leeuwarden`), as the judgments list filters by it (`?court=`). */
const ECLI_CODE: Readonly<Record<string, string>> = {
	'rechtbank amsterdam': 'RBAMS',
	'rechtbank den haag': 'RBDHA',
	'rechtbank gelderland': 'RBGEL',
	'rechtbank limburg': 'RBLIM',
	'rechtbank midden-nederland': 'RBMNE',
	'rechtbank noord-holland': 'RBNHO',
	'rechtbank noord-nederland': 'RBNNE',
	'rechtbank oost-brabant': 'RBOBR',
	'rechtbank overijssel': 'RBOVE',
	'rechtbank rotterdam': 'RBROT',
	'rechtbank zeeland-west-brabant': 'RBZWB',
	'gerechtshof amsterdam': 'GHAMS',
	'gerechtshof arnhem-leeuwarden': 'GHARL',
	'gerechtshof den haag': 'GHDHA',
	'gerechtshof s-hertogenbosch': 'GHSHE'
};

/** The list of judgments of a court, or null where its ECLI code is not known. */
export function judgmentsHref(courtName: string): string | null {
	const code = ECLI_CODE[plain(courtName)];
	return code ? queryHref(listPath('judgments'), { court: code }) : null;
}

/** The article of the RI that draws an area, at its readable address; null where the text names it otherwise. */
export const articleHref = (area: Area): string | null =>
	area.article_number ? padHref({ kind: 'artikel', law: RI, number: area.article_number }) : null;

/** `art. 8 RI`. */
export const articleLabel = (area: Area): string | null =>
	area.article_number ? `art. ${area.article_number} RI` : null;

/** Whether the text of the law names the municipality otherwise than the CBS does. */
export const textDiffers = (g: Gemeente): boolean =>
	g.district_check === 'differs' ||
	g.district_check === 'not_in_text' ||
	g.circuit_check === 'differs' ||
	g.circuit_check === 'not_in_text';

const plain = (s: string) =>
	s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’'`]/g, '').toLowerCase();

/** The municipalities a typed name leads to: those that begin with it first, then those that hold it. */
export function findGemeenten(items: readonly Gemeente[], typed: string, max = 8): Gemeente[] {
	const q = plain(typed.trim());
	if (!q) return [];
	const starts: Gemeente[] = [];
	const holds: Gemeente[] = [];
	for (const g of items) {
		const n = plain(g.name);
		if (n.startsWith(q)) starts.push(g);
		else if (n.includes(q)) holds.push(g);
	}
	return [...starts, ...holds].slice(0, max);
}

/** Whether another municipality in the map bears the name, so the province tells them apart. */
export const sharesName = (items: readonly Gemeente[], g: Gemeente): boolean =>
	items.some((o) => o.code !== g.code && o.name === g.name);

export type PerRechtbank = { district: Area; circuit: Area; gemeenten: Gemeente[] };

/** The municipalities per arrondissement, in the order of its article, then its name. */
export function perRechtbank(items: readonly Gemeente[]): PerRechtbank[] {
	const groups = new globalThis.Map<string, PerRechtbank>();
	for (const g of items) {
		const hit = groups.get(g.district.code);
		if (hit) hit.gemeenten.push(g);
		else groups.set(g.district.code, { district: g.district, circuit: g.circuit, gemeenten: [g] });
	}
	const order = (p: PerRechtbank) => p.district.article_number ?? '~';
	return [...groups.values()]
		.map((p) => ({
			...p,
			gemeenten: p.gemeenten.toSorted((a, b) => a.name.localeCompare(b.name, 'nl'))
		}))
		.sort(
			(a, b) =>
				order(a).localeCompare(order(b), 'nl', { numeric: true }) ||
				a.district.name.localeCompare(b.district.name, 'nl')
		);
}

/** `1 jan. 2026`, the day the CBS map holds. */
export const peildatum = (year: number): string => `1 jan. ${year}`;
