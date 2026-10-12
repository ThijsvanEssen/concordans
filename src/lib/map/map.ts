// The map (concept ux-voorstel/13-map, variant 7, step 1): what a reader keeps while reading,
// a lid of an article, an overweging of a judgment, a Kamerstuk, a motie, any bron. It lives
// in this browser; a link (?map=) carries it to someone else, a list of citations to a memo,
// a CSV to a spreadsheet. It replaces Verbonden's Verzamel.
import { netwerkParams } from '$lib/netwerk/netwerk';
import { parseNodeId } from '$lib/vocabulary';

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
	/** The reader's note on the map as a whole, shown at its top. */
	notitie?: string | null;
	/** The reader's note per group (a law, a dossier, a judgment), by the group's key. */
	groepNotities?: GroepNotities;
};

/** Notes per group, by `groepSleutel`. */
export type GroepNotities = Record<string, string>;

/** A map from a link: its name, items, order and note as the link gives them. */
export type Gedeeld = {
	naam: string | null;
	items: MapItem[];
	volgorde: Map['volgorde'];
	notitie: string | null;
	groepNotities: GroepNotities;
};

/** An item's key: the bron and its place. */
export const sleutelVan = (i: Pick<MapItem, 'id' | 'at'>) => (i.at ? `${i.id}#${i.at}` : i.id);

/**
 * A group's key, from its bron rather than its name, so a note stays with its law when the
 * law's name loads later: an article by its law (`wet:bwbr0052872`), a Kamerstuk by its
 * dossier (`dossier:36764`), a judgment by itself; the rest by the group's name.
 */
export function groepSleutel(i: Pick<MapItem, 'id' | 'groep'>): string {
	const [collectie, key = ''] = i.id.split('/');
	if (collectie === 'articles' && /^bwbr\d+_/i.test(key))
		return `wet:${key.slice(0, key.indexOf('_')).toLowerCase()}`;
	if (collectie === 'judgments') return i.id;
	const dossier = /\b(\d{5}(?:-[A-Z0-9]+)?)\b/.exec(i.groep)?.[1];
	if (collectie === 'documents' && dossier) return `dossier:${dossier}`;
	return `groep:${i.groep}`;
}

/** The groups in the order their first item was kept, each with its items in that order. */
export function groepen(
	items: readonly MapItem[]
): { groep: string; sleutel: string; items: MapItem[] }[] {
	const m = new Map<string, MapItem[]>();
	for (const i of items) m.set(i.groep, [...(m.get(i.groep) ?? []), i]);
	return [...m].map(([groep, items]) => ({ groep, sleutel: groepSleutel(items[0]), items }));
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

/** The address params of a map: its items, its name, its order where its own, its note. */
export function mapParams(
	m: Pick<Map, 'items' | 'naam' | 'volgorde' | 'notitie' | 'groepNotities'>
): URLSearchParams {
	const p = new URLSearchParams({ map: naarParam(m.items), mapnaam: m.naam });
	if (m.volgorde === 'eigen') p.set('mapvolgorde', 'eigen');
	if (m.notitie?.trim()) p.set('mapnotitie', m.notitie.trim());
	const groep = naarGroepParam(m.groepNotities, m.items);
	if (groep) p.set('mapgroepen', groep);
	return p;
}

/** The notes per group as `sleutel~notitie;…`, only of groups the map holds. */
export function naarGroepParam(
	notities: GroepNotities | null | undefined,
	items: readonly MapItem[]
): string {
	const houdt = new Set(items.map(groepSleutel));
	return Object.entries(notities ?? {})
		.filter(([k, v]) => houdt.has(k) && v.trim())
		.map(([k, v]) => `${veld(k)}~${veld(v.trim())}`)
		.join(';');
}

export function uitGroepParam(v: string | null): GroepNotities {
	const uit: GroepNotities = {};
	for (const deel of (v ?? '').split(';')) {
		const [k, n] = deel.split('~').map(terug);
		if (k && n?.trim()) uit[k] = n.trim();
	}
	return uit;
}

/** A map from an address; null where it holds no item. A link without a note reads as before. */
export function uitParams(p: URLSearchParams): Gedeeld | null {
	const items = uitParam(p.get('map'));
	if (!items.length) return null;
	return {
		naam: p.get('mapnaam'),
		items,
		volgorde: p.get('mapvolgorde') === 'eigen' ? 'eigen' : 'groep',
		notitie: p.get('mapnotitie')?.trim() || null,
		groepNotities: uitGroepParam(p.get('mapgroepen'))
	};
}

/** The params a map's address carries, for a link that lands elsewhere first. */
export const MAP_PARAMS = ['map', 'mapnaam', 'mapvolgorde', 'mapnotitie', 'mapgroepen'] as const;

// ── The network ─────────────────────────────────────────────────────────────
/** The bronnen of a map, each once (two leden of one article are one bron), in its order. */
export const netwerkIds = (items: readonly MapItem[]): string[] => [
	...new Set(items.map((i) => i.id).filter((id) => parseNodeId(id) !== null))
];

/**
 * The Verkenner's network of the map's bronnen only: the chosen bronnen of ?netwerk, the
 * bronnen between them off (?tussen=0), so the canvas holds what the map holds and its
 * Netwerk panel adds to it.
 */
export function netwerkHref(items: readonly MapItem[]): string | null {
	const ids = netwerkIds(items);
	if (!ids.length) return null;
	const params = netwerkParams({ ids, uit: new Set(), tussen: false });
	const query = Object.entries(params)
		.filter(([, v]) => v !== null)
		.map(([k, v]) => `${k}=${encodeURIComponent(v!).replaceAll('%2F', '/').replaceAll('%2C', ',')}`)
		.join('&');
	return `/explore?${query}`;
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
 * an indented line under its citation; per group, or in the reader's own order. The map's
 * own note goes above, as its first paragraph; a group's note under the group's name.
 */
export function citaten(
	items: readonly MapItem[],
	volgorde: Map['volgorde'] = 'groep',
	notitie?: string | null,
	groepNotities?: GroepNotities | null
): string {
	const kop = notitie?.trim() ? `${notitie.trim()}\n\n` : '';
	if (volgorde === 'eigen') return kop + items.map((i, n) => citaat(i, n + 1)).join('\n');
	let n = 0;
	return (
		kop +
		groepen(items)
			.map(({ groep, sleutel, items }) => {
				const bij = groepNotities?.[sleutel]?.trim();
				return [groep, ...(bij ? [bij] : []), ...items.map((i) => citaat(i, ++n))].join('\n');
			})
			.join('\n\n')
	);
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
