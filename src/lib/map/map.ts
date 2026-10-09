// The map (concept ux-voorstel/13-map, variant 7, step 1): what a reader keeps while reading,
// a lid of an article, an overweging of a judgment, a Kamerstuk, a motie, any bron. It lives
// in this browser; a link (?map=) carries it to someone else, a list of citations to a memo,
// a CSV to a spreadsheet. It replaces Verbonden's Verzamel.

/** One thing kept: a bron, or a place in it (`lid-2`, `rov-5.7.1`), with how it is cited. */
export type MapItem = {
	/** The bron as a link names it: `articles/bwbr0005289_162`, `judgments/ecli_nl_hr_2019_2006`. */
	id: string;
	/** The place in it, as its anchor: `lid-2`, `rov-5.7.1`; empty for the whole bron. */
	at: string;
	/** The citation, short: `art. 6:162 lid 2 BW`, `HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1`. */
	kort: string;
	/** The citation in full where there is one, for the list of citations. */
	voluit?: string | null;
	/** What it belongs to, for its group: a law, a dossier, a judgment's case. */
	groep: string;
	/** The reader's own note, shown in italics under the citation (step 2). */
	notitie?: string | null;
};

/** A map with a name: the items of one piece of research (step 2). */
export type Map = {
	id: string;
	naam: string;
	items: MapItem[];
	/** The order shown: per law or dossier (the order things were kept), or the reader's own. */
	volgorde: 'groep' | 'eigen';
	/** When it last changed, as an ISO time. */
	gewijzigd: string;
};

/** An item's key: the bron and its place. */
export const sleutelVan = (i: Pick<MapItem, 'id' | 'at'>) => (i.at ? `${i.id}#${i.at}` : i.id);

/** The groups in the order their first item was kept, each with its items in that order. */
export function groepen(items: readonly MapItem[]): { groep: string; items: MapItem[] }[] {
	const m = new Map<string, MapItem[]>();
	for (const i of items) m.set(i.groep, [...(m.get(i.groep) ?? []), i]);
	return [...m].map(([groep, items]) => ({ groep, items }));
}

// ── The link ────────────────────────────────────────────────────────────────
// `?map=` holds the items one after another, each its five fields: the bron, its place,
// its short citation, its group and its note, so a map opens elsewhere without asking the
// API. Its name goes beside it (`mapnaam=`).
// Fields are separated by `~`, items by `;`; only those two and `%` are escaped here, the
// address encodes the rest once.
const veld = (s: string) => s.replaceAll('%', '%25').replaceAll('~', '%7E').replaceAll(';', '%3B');
const terug = (s: string) => s.replaceAll('%7E', '~').replaceAll('%3B', ';').replaceAll('%25', '%');

export function naarParam(items: readonly MapItem[]): string {
	return items
		.map((i) => {
			const velden = [i.id, i.at, i.kort, i.groep, ...(i.notitie ? [i.notitie] : [])];
			return velden.map(veld).join('~');
		})
		.join(';');
}

export function uitParam(v: string | null): MapItem[] {
	if (!v) return [];
	return v.split(';').flatMap((deel) => {
		const [id, at, kort, groep, notitie] = deel.split('~').map((x) => terug(x ?? ''));
		return id && /^[a-z_]+\/[\w.:-]+$/i.test(id) && kort
			? [{ id, at: at ?? '', kort, groep: groep || kort, ...(notitie ? { notitie } : {}) }]
			: [];
	});
}

/** The items of `b` that `a` does not hold yet, after `a`'s. */
export function samen(a: readonly MapItem[], b: readonly MapItem[]): MapItem[] {
	const al = new Set(a.map(sleutelVan));
	return [...a, ...b.filter((i) => !al.has(sleutelVan(i)))];
}

// ── Citations and CSV ───────────────────────────────────────────────────────

const citaat = (i: MapItem, n: number) =>
	`${n}. ${i.voluit || i.kort}${i.notitie ? `\n   ${i.notitie}` : ''}`;

/**
 * The map as a list of citations for a memo: numbered, the full form where kept, a note as
 * an indented line under its citation; per group, or in the reader's own order.
 */
export function citaten(items: readonly MapItem[], volgorde: Map['volgorde'] = 'groep'): string {
	if (volgorde === 'eigen') return items.map((i, n) => citaat(i, n + 1)).join('\n');
	let n = 0;
	return groepen(items)
		.map(({ groep, items }) => [groep, ...items.map((i) => citaat(i, ++n))].join('\n'))
		.join('\n\n');
}

const cel = (v: string) => (/[";\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** As Verbonden's CSV: semicolons and a byte order mark, as Excel with Dutch settings reads it. */
export function csv(items: readonly MapItem[], adres: (i: MapItem) => string): string {
	const rijen = [
		['volgorde', 'groep', 'citaat', 'vindplaats', 'aantekening', 'adres'],
		...items.map((i, n) => [
			String(n + 1),
			i.groep,
			i.voluit || i.kort,
			i.at,
			i.notitie ?? '',
			adres(i)
		])
	];
	return '﻿' + rijen.map((r) => r.map(cel).join(';')).join('\r\n');
}

/**
 * An item one place up or down: among the items of its group where the map is shown per
 * group, else among all. Unmoved at the edge.
 */
export function verschuif(
	items: readonly MapItem[],
	sleutel: string,
	richting: -1 | 1,
	volgorde: Map['volgorde']
): MapItem[] {
	const i = items.findIndex((x) => sleutelVan(x) === sleutel);
	if (i < 0) return [...items];
	const groep = items[i].groep;
	let j = i + richting;
	if (volgorde === 'groep')
		while (j >= 0 && j < items.length && items[j].groep !== groep) j += richting;
	if (j < 0 || j >= items.length) return [...items];
	const uit = [...items];
	[uit[i], uit[j]] = [uit[j], uit[i]];
	return uit;
}
