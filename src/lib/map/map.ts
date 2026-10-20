// The map (concept ux-voorstel/13-map, variant 7, step 1): what a reader keeps while reading,
// a lid of an article, an overweging of a judgment, a Kamerstuk, a motie, any bron. It lives
// in this browser; a link (share.ts, in the fragment) carries it to someone else, a list of citations to a memo,
// a CSV to a spreadsheet. It replaces Verbonden's Verzamel.
import { netwerkParams } from '$lib/selection/netwerk';
import { dossierLabel, officialNumber } from '$lib/bron/dossier-naam';
import { bronLabel, parseNodeId } from '$lib/vocabulary';
import { queryHref } from '$lib/util/address';
import { buildBronHref } from '$lib/bron/href';
import { padOfFocus } from '$lib/bron/address';
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
	 *  in Bundels and the CSV goes there, not through a redirect. */
	pad?: string;
	/** A source outside Concordans (`external:<id>`): what it is, as its label in the row. */
	kind?: SourceKind;
	/** Its address on the web, where the reader gave one. */
	url?: string;
};

/** What a source outside Concordans is: its label in the row. */
export const SOURCE_KINDS = {
	book: 'Boek',
	journal: 'Tijdschrift',
	annotation: 'Annotatie',
	webpage: 'Webpagina',
	other: 'Overig'
} as const satisfies Record<SourceKind, string>;
export type SourceKind = 'book' | 'journal' | 'annotation' | 'webpage' | 'other';

/** The group of a source outside Concordans where the reader chooses none of the map's. */
export const OTHER_SOURCES = 'Andere bronnen';

/** An item that is a source outside Concordans. */
export const isExternal = (i: Pick<MapItem, 'id'>) => i.id.startsWith('external:');

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
	/** The day of the visit before to its own page: what is new came after it. */
	since?: string | null;
	/** The day of the last visit to its own page. */
	seen?: string | null;
};

/** Notes per group, by the group's key. */
export type GroepNotities = Record<string, string>;

/** A map from a link: its name, items, order and note as the link gives them. */
export type SharedMap = {
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

/** Bundels by name in a sentence: `Losse markeringen en Thuiswerk`. */
export const namesOf = (maps: readonly Pick<Map, 'naam'>[]): string =>
	maps.length < 2
		? (maps[0]?.naam ?? '')
		: `${maps
				.slice(0, -1)
				.map((m) => m.naam)
				.join(', ')} en ${maps.at(-1)!.naam}`;

/** What is its own group where no law or dossier holds it: never keyed by a name. */
const OWN_GROUP = new Set(['judgments', 'documents', 'decisions']);

/**
 * What a bron belongs to, as the reader knows it from the API: the law of an article (its BWB
 * id or CELEX), the dossier of a Kamerstuk or a vote, and the group's name where it has one.
 */
type BewaarContext = {
	groep?: string | null;
	dossier?: string | null;
	wet?: string | null;
	/** A group of the map chosen by the reader, by its key. */
	groupKey?: string | null;
};

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
	const groupKey = context.groupKey
		? context.groupKey
		: wet
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

/**
 * A dossier as the map keeps it: by its number, as a link names it (`dossiers/36600-VII`,
 * never its node key), in its own group.
 */
export function bewaarDossier(d: {
	number: string;
	title?: string | null;
	short_title?: string | null;
}): MapItem {
	const nummer = officialNumber(d.number);
	const naam = d.short_title ?? d.title;
	return bewaarItem(
		`dossiers/${d.number}`,
		{ kort: `Kamerstukken ${nummer}`, voluit: `Kamerstukken ${nummer}${naam ? ` (${naam})` : ''}` },
		{ groep: dossierLabel(d), dossier: d.number }
	);
}

/** The place an item opens: its readable address, else the bron in Samenhang; at its place. */
export function itemHref(i: Pick<MapItem, 'id' | 'at' | 'pad'>): string {
	const href = i.pad ?? buildBronHref(null, i.id);
	return i.at ? `${href.split('#')[0]}#${encodeURIComponent(i.at)}` : href;
}

/** A name no bundel has yet: the name itself, else numbered on (`Thuiswerk 2`). */
export function freeName(name: string, taken: ReadonlySet<string>): string {
	if (!taken.has(name)) return name;
	let n = 2;
	while (taken.has(`${name} ${n}`)) n++;
	return `${name} ${n}`;
}

/** What an item is, as the CSV names it: its kind of bron, or the kind of a source outside. */
const kindLabel = (i: MapItem): string => {
	if (isExternal(i)) return SOURCE_KINDS[i.kind ?? 'other'];
	const collection = parseNodeId(i.id)?.collection;
	return collection ? bronLabel(collection) : '';
};

/** An item's address in a CSV: the bron's in Concordans, a source outside it its own. */
export const itemAddress = (i: MapItem, origin: string): string =>
	isExternal(i) ? (i.url ?? '') : new URL(itemHref(i), origin).toString();

/** A web address as the reader may give one: http or https, else none. */
export function webAddress(text: string | null | undefined): string | null {
	const typed = (text ?? '').trim();
	// A domain without its scheme (`voorbeeld.nl/boek`) is read as https.
	const full = /^[\w-]+(?:\.[\w-]+)+(?:[/?#:]|$)/.test(typed) ? `https://${typed}` : typed;
	try {
		const url = new URL(full);
		return /^https?:$/.test(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

/**
 * A source outside Concordans, as the reader cites it: its citation, kept as typed, is its
 * title in the map, its Citaten and its CSV; in a group of the map, else under Andere bronnen.
 */
export function externalItem(source: {
	citation: string;
	kind: SourceKind;
	url?: string | null;
	group?: { name: string; key: string } | null;
}): MapItem {
	const url = webAddress(source.url);
	const item = bewaarItem(
		`external:${Math.random().toString(36).slice(2, 10)}`,
		{ kort: source.citation.trim() },
		source.group
			? { groep: source.group.name, groupKey: source.group.key }
			: { groep: OTHER_SOURCES }
	);
	return { ...item, kind: source.kind, ...(url ? { url } : {}) };
}

/** The one group of a bundel's judgments, whatever key each was kept under (decision 20A). */
export const JUDGMENTS_GROUP = 'rechtspraak';
const JUDGMENTS_NAME = 'Rechtspraak';

/** A judgment, or a source outside Concordans the reader put in a judgment's group. */
const inJudgments = (i: Pick<MapItem, 'id' | 'groupKey'>) =>
	parseNodeId(i.id)?.collection === 'judgments' ||
	parseNodeId(i.groupKey)?.collection === 'judgments';

/** The group an item is shown in: a judgment under Rechtspraak, the rest by its own key. */
export const groupKeyOf = (i: Pick<MapItem, 'id' | 'groupKey'>): string =>
	inJudgments(i) ? JUDGMENTS_GROUP : i.groupKey;

/** The groups in the order their first item was kept, each with its items in that order. */
export function groepen(
	items: readonly MapItem[]
): { groep: string; sleutel: string; items: MapItem[] }[] {
	// By the group's key, so one dossier is one group whether a Kamerstuk of it or the dossier
	// was kept ("Kamerstuk 36764", "Kamerstuk 36764 Cyberbeveiligingswet"); its name the one
	// that says the most. The judgments together, under Rechtspraak.
	const m = new Map<string, MapItem[]>();
	for (const i of items) m.set(groupKeyOf(i), [...(m.get(groupKeyOf(i)) ?? []), i]);
	return [...m].map(([sleutel, items]) => ({
		groep:
			sleutel === JUDGMENTS_GROUP
				? JUDGMENTS_NAME
				: items.map((i) => i.groep).reduce((a, b) => (b.length > a.length ? b : a)),
		sleutel,
		items
	}));
}

/** A citation without the place in it (`r.o. 5.1`, `alinea 4`, `§ Artikel 21`): `HR 20 december
 *  2019, ECLI:…`, `Kamerstukken II …, nr. 57`. */
const withoutPlace = (kort: string) => kort.replace(/,\s*(?:r\.o\.|alinea|§)\s.*$/, '');

/** The bronnen whose kept places stand under them: an r.o. its judgment's, an alinea its stuk's. */
const PLACES_UNDER = new Set(['judgments', 'documents']);

/** A bron in a bundel: kept itself or not, with its places (r.o.'s, alineas) under it. */
type PlaceRow = { head: MapItem; kept: boolean; places: MapItem[] };

/**
 * The rows of a group, each bron once, in the order first kept: a judgment or a Kamerstuk
 * where it is kept itself, its kept r.o.'s or alineas as places under it. One place alone
 * stands as its bron's row; two or more stand under the bron, which heads them without being
 * kept. Every other item is a row of its own.
 */
export function placeRows(items: readonly MapItem[]): PlaceRow[] {
	const byId = new Map<string, MapItem[]>();
	for (const i of items) {
		const key = PLACES_UNDER.has(parseNodeId(i.id)?.collection ?? '') ? i.id : itemKey(i);
		byId.set(key, [...(byId.get(key) ?? []), i]);
	}
	return [...byId.values()].map((all) => {
		const whole = all.find((i) => !i.at);
		const places = all.filter((i) => i.at);
		if (whole) return { head: whole, kept: true, places };
		if (places.length === 1) return { head: places[0], kept: true, places: [] };
		const first = places[0];
		return {
			head: { ...first, at: '', kort: withoutPlace(first.kort), voluit: null, notitie: null },
			kept: false,
			places
		};
	});
}

/**
 * A row's citation on one line: the full form where it adds to the short one (an ECLI), the
 * short one where the full form only writes it out (`artikel 6:162 lid 2 Burgerlijk Wetboek`),
 * else the full form under it. A place under its bron is named by the place alone, a
 * dossier by its number (its group names it).
 */
export function rowTitle(
	i: Pick<MapItem, 'id' | 'at' | 'kort' | 'voluit'>,
	place = false
): { title: string; sub: string | null } {
	const own = place ? /(?:\br\.o\.|\balinea|§)\s.*$/.exec(i.kort)?.[0] : null;
	if (own) return { title: own, sub: null };
	const collection = parseNodeId(i.id)?.collection;
	// A dossier kept whole stands under its group, which names it: its row cites it by number
	// alone, not its title again (UX-toets A14 #6).
	// In the number of its group's head: `Kamerstuk 36600 VII` (dossierLabel, A21 #4).
	if (collection === 'dossiers')
		return {
			title: i.kort.replace(/\s*\(.*\)$/, '').replace(/^Kamerstukken\b/, 'Kamerstuk'),
			sub: null
		};
	const full = i.voluit?.trim();
	if (!full || full === i.kort) return { title: i.kort, sub: null };
	if (full.startsWith(i.kort)) return { title: full, sub: null };
	if (collection === 'articles' || collection === 'instruments')
		return { title: i.kort, sub: null };
	return { title: i.kort, sub: full };
}

// ── Reading an item back ────────────────────────────────────────────────────
/** A bron as a link names it: `articles/bwbr0005289_162`. */
const NODE_ID = /^[a-z_]+\/[\w.:-]+$/i;
/** A source outside Concordans: `external:<id>`. */
const EXTERNAL_ID = /^external:[a-z0-9]+$/;

/** A string field of a value read back, where it holds text. */
const textOf = (o: Record<string, unknown>, k: string) =>
	typeof o[k] === 'string' && o[k].trim() ? o[k] : null;

/**
 * An item as this browser or a link gives it back, its known fields only; null where it is
 * in an older or broken form.
 */
export function readItem(v: unknown): MapItem | null {
	if (!v || typeof v !== 'object') return null;
	const o = v as Record<string, unknown>;
	const id = textOf(o, 'id');
	const kort = textOf(o, 'kort');
	const groep = textOf(o, 'groep');
	const groupKey = textOf(o, 'groupKey');
	if (!id || !(NODE_ID.test(id) || EXTERNAL_ID.test(id)) || !kort || !groep || !groupKey)
		return null;
	const at = textOf(o, 'at') ?? '';
	const voluit = textOf(o, 'voluit');
	const notitie = textOf(o, 'notitie');
	const pad = textOf(o, 'pad');
	const kind = textOf(o, 'kind');
	const url = webAddress(textOf(o, 'url'));
	return {
		id,
		at,
		kort,
		...(voluit ? { voluit } : {}),
		groep,
		groupKey,
		...(notitie ? { notitie } : {}),
		...(pad?.startsWith('/') && !pad.startsWith('//') ? { pad } : {}),
		...(EXTERNAL_ID.test(id)
			? { kind: kind && kind in SOURCE_KINDS ? (kind as SourceKind) : 'other' }
			: {}),
		...(EXTERNAL_ID.test(id) && url ? { url } : {})
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
		['volgorde', 'groep', 'soort', 'citaat', 'vindplaats', 'aantekening', 'adres'],
		(volgorde === 'eigen' ? items : reeks.flatMap((g) => g.items)).map((i, n) => [
			String(n + 1),
			naamVan.get(groupKeyOf(i)) ?? i.groep,
			kindLabel(i),
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
	const groep = groupKeyOf(items[i]);
	let j = i + richting;
	if (volgorde === 'groep')
		while (j >= 0 && j < items.length && groupKeyOf(items[j]) !== groep) j += richting;
	if (j < 0 || j >= items.length) return [...items];
	const uit = [...items];
	[uit[i], uit[j]] = [uit[j], uit[i]];
	return uit;
}
