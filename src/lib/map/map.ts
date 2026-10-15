// The map (concept ux-voorstel/13-map, variant 7, step 1): what a reader keeps while reading,
// a lid of an article, an overweging of a judgment, a Kamerstuk, a motie, any bron. It lives
// in this browser; a link (?map=) carries it to someone else, a list of citations to a memo,
// a CSV to a spreadsheet. It replaces Verbonden's Verzamel.
import { netwerkParams } from '$lib/selection/netwerk';
import { dossierLabel } from '$lib/bron/dossier-naam';
import { bronLabel, parseNodeId } from '$lib/vocabulary';
import { queryHref } from '$lib/util/address';
import { buildBronHref } from '$lib/bron/href';
import { padOfFocus } from '$lib/bron/leesbaar';
import { csvText } from '$lib/text/csv';
import { anchorLabel } from '$lib/text/anchor';

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
	/** Its group's key, from the bron (`bewaarItem`): `wet:bwbr0005289`, `dossier:36889`. */
	groupKey: string;
	/** The reader's own note, shown in italics under the citation (step 2). */
	notitie?: string | null;
	/** Its readable address where it was known when kept (`/kamerstukken/34372/14`): its link
	 *  in Gemarkeerd and the CSV goes there, not through a redirect. */
	pad?: string;
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

/** Notes per group, by the group's key. */
export type GroepNotities = Record<string, string>;

/** A map from a link: its name, items, order and note as the link gives them. */
export type Gedeeld = {
	naam: string | null;
	items: MapItem[];
	volgorde: Map['volgorde'];
	notitie: string | null;
	groepNotities: GroepNotities;
	/** Items of the link in an older or broken form, left out: the page names how many. */
	skipped: number;
};

/** An item's key: the bron and its place. */
export const itemKey = (i: Pick<MapItem, 'id' | 'at'>) => (i.at ? `${i.id}#${i.at}` : i.id);

/** A dossier's number as a key: `36600-XV` for `36600 XV`, `36600_xv` or `36600-XV`. */
const dossierSleutel = (nr: string) =>
	`dossier:${nr
		.trim()
		.replace(/[\s_]+/, '-')
		.toUpperCase()}`;

/** What is its own group where no law or dossier holds it: never keyed by a name. */
const OWN_GROUP = new Set(['judgments', 'documents', 'decisions']);

/**
 * What a bron belongs to, as the reader knows it from the API: the law of an article (its BWB
 * id or CELEX), the dossier of a Kamerstuk or a vote, and the group's name where it has one.
 */
type BewaarContext = { groep?: string | null; dossier?: string | null; wet?: string | null };

/**
 * A bron as the map keeps it: its citations as the reader gives them, its group from the
 * bron, never from a name. Its group's key, so a note stays with its law when the law's name
 * loads later: an article or a law by its law (`wet:bwbr0052872`), a Kamerstuk, a vote or a
 * dossier by its dossier (`dossier:36764`), a judgment, and a Kamerstuk or vote without a
 * dossier, by itself; the rest by its group's name, a person under Kamerlid.
 */
export function bewaarItem(
	id: string,
	cite: { kort: string; voluit?: string | null; at?: string | null },
	context: BewaarContext = {}
): MapItem {
	const collectie = parseNodeId(id)?.collection;
	const wet = context.wet?.trim().toLowerCase() || null;
	const dossier = context.dossier?.trim() || null;
	const groep =
		(collectie === 'members' ? bronLabel('members') : context.groep?.trim()) ||
		(dossier ? dossierLabel({ number: dossier }) : null) ||
		(collectie ? bronLabel(collectie) : cite.kort);
	const groupKey = wet
		? `wet:${wet}`
		: dossier
			? dossierSleutel(dossier)
			: collectie && OWN_GROUP.has(collectie)
				? id
				: `groep:${groep}`;
	const pad = padOfFocus(id);
	return {
		id,
		at: cite.at ?? '',
		kort: cite.kort,
		...(cite.voluit ? { voluit: cite.voluit } : {}),
		groep,
		groupKey,
		...(pad ? { pad } : {})
	};
}

/** The place an item opens: its readable address, else the bron in Samenhang; at its place. */
export function itemHref(i: Pick<MapItem, 'id' | 'at' | 'pad'>): string {
	const href = i.pad ?? buildBronHref(null, i.id);
	return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
}

/** The groups in the order their first item was kept, each with its items in that order. */
export function groepen(
	items: readonly MapItem[]
): { groep: string; sleutel: string; items: MapItem[] }[] {
	// By the group's key, so one dossier is one group whether a Kamerstuk of it or the dossier
	// was kept ("Kamerstuk 36764", "Kamerstuk 36764 Cyberbeveiligingswet"); its name the one
	// that says the most.
	const m = new Map<string, MapItem[]>();
	for (const i of items) m.set(i.groupKey, [...(m.get(i.groupKey) ?? []), i]);
	return [...m].map(([sleutel, items]) => ({
		groep: items.map((i) => i.groep).reduce((a, b) => (b.length > a.length ? b : a)),
		sleutel,
		items
	}));
}

// ── The link ────────────────────────────────────────────────────────────────
// `?map=` holds the items one after another, each its six fields: the bron, its place, its
// short citation, its group, its note (empty where none) and its group's key, and a seventh,
// its readable address, where it was known; so a map opens
// elsewhere without asking the API; an item without its six fields is left out, and the
// page names how many. Its name goes beside it (`mapnaam=`).
// Fields are separated by `~`, items by `;`; only those two and `%` are escaped here, the
// address encodes the rest once.
const veld = (s: string) => s.replaceAll('%', '%25').replaceAll('~', '%7E').replaceAll(';', '%3B');
const terug = (s: string) => s.replaceAll('%7E', '~').replaceAll('%3B', ';').replaceAll('%25', '%');

export function itemsParam(items: readonly MapItem[]): string {
	return items
		.map((i) => {
			const velden = [i.id, i.at, i.kort, i.groep, i.notitie ?? '', i.groupKey];
			if (i.pad) velden.push(i.pad);
			return velden.map(veld).join('~');
		})
		.join(';');
}

/** The items of a link, and how many it holds in an older or broken form (left out). */
export function readParam(v: string | null): { items: MapItem[]; skipped: number } {
	if (!v) return { items: [], skipped: 0 };
	const delen = v.split(';');
	const items = delen.flatMap((deel) => {
		const [id, at, kort, groep, notitie, groupKey, pad] = deel.split('~').map(terug);
		return id && /^[a-z_]+\/[\w.:-]+$/i.test(id) && kort && groep && groupKey
			? [
					{
						id,
						at: at ?? '',
						kort,
						groep,
						...(notitie ? { notitie } : {}),
						groupKey,
						...(pad?.startsWith('/') ? { pad } : {})
					}
				]
			: [];
	});
	return { items, skipped: delen.length - items.length };
}

/** The address params of a map: its items, its name, its order where its own, its note. */
export function mapParams(
	m: Pick<Map, 'items' | 'naam' | 'volgorde' | 'notitie' | 'groepNotities'>
): URLSearchParams {
	const p = new URLSearchParams({ map: itemsParam(m.items), mapnaam: m.naam });
	if (m.volgorde === 'eigen') p.set('mapvolgorde', 'eigen');
	if (m.notitie?.trim()) p.set('mapnotitie', m.notitie.trim());
	const groep = naarGroepParam(m.groepNotities, m.items);
	if (groep) p.set('mapgroepen', groep);
	return p;
}

/** The notes per group as `sleutel~notitie;…`, only of groups the map holds. */
function naarGroepParam(
	notities: GroepNotities | null | undefined,
	items: readonly MapItem[]
): string {
	const houdt = new Set(items.map((i) => i.groupKey));
	return Object.entries(notities ?? {})
		.filter(([k, v]) => houdt.has(k) && v.trim())
		.map(([k, v]) => `${veld(k)}~${veld(v.trim())}`)
		.join(';');
}

function uitGroepParam(v: string | null): GroepNotities {
	const uit: GroepNotities = {};
	for (const deel of (v ?? '').split(';')) {
		const [k, n] = deel.split('~').map(terug);
		if (k && n?.trim()) uit[k] = n.trim();
	}
	return uit;
}

/**
 * A map from an address; null where it holds nothing, read or left out. A link without a note
 * reads as before.
 */
export function sharedMapOf(p: URLSearchParams): Gedeeld | null {
	const { items, skipped } = readParam(p.get('map'));
	if (!items.length && !skipped) return null;
	return {
		naam: p.get('mapnaam'),
		items,
		volgorde: p.get('mapvolgorde') === 'eigen' ? 'eigen' : 'groep',
		notitie: p.get('mapnotitie')?.trim() || null,
		groepNotities: uitGroepParam(p.get('mapgroepen')),
		skipped
	};
}

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
	const query = new URLSearchParams();
	for (const [name, value] of Object.entries(params)) if (value !== null) query.set(name, value);
	return queryHref('/explore', query);
}

/** The items of `b` that `a` does not hold yet, after `a`'s. */
export function withItems(a: readonly MapItem[], b: readonly MapItem[]): MapItem[] {
	const al = new Set(a.map(itemKey));
	return [...a, ...b.filter((i) => !al.has(itemKey(i)))];
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

/**
 * The map as a CSV, its rows as the map shows them: per group in the order of the groups, or
 * in the reader's own order; each under its group's name, its place as the reader prints it.
 */
export function csv(
	items: readonly MapItem[],
	adres: (i: MapItem) => string,
	volgorde: Map['volgorde'] = 'groep'
): string {
	const reeks = groepen(items);
	const naamVan = new Map(reeks.map((g) => [g.sleutel, g.groep]));
	return csvText(
		['volgorde', 'groep', 'citaat', 'vindplaats', 'aantekening', 'adres'],
		(volgorde === 'eigen' ? items : reeks.flatMap((g) => g.items)).map((i, n) => [
			String(n + 1),
			naamVan.get(i.groupKey) ?? i.groep,
			i.voluit || i.kort,
			(i.at && anchorLabel(i.at, i.id)) || '',
			i.notitie ?? '',
			adres(i)
		])
	);
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
	const i = items.findIndex((x) => itemKey(x) === sleutel);
	if (i < 0) return [...items];
	const groep = items[i].groupKey;
	let j = i + richting;
	if (volgorde === 'groep')
		while (j >= 0 && j < items.length && items[j].groupKey !== groep) j += richting;
	if (j < 0 || j >= items.length) return [...items];
	const uit = [...items];
	[uit[i], uit[j]] = [uit[j], uit[i]];
	return uit;
}
