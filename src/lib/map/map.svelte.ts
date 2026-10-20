// The bundels as the page holds them, in this browser: each with a name; the first, Losse
// markeringen, always there and always so named (it is emptied, never deleted or renamed). Bewaar keeps in Losse
// markeringen; another bundel holds a bron only where the reader puts it there by name
// (decision 20A: no hidden "active bundel"). A bundel is changed by its id.
import {
	freeName,
	readItem,
	withItems,
	itemKey,
	verschuif,
	type SharedMap,
	type GroepNotities,
	type Map,
	type MapItem
} from './map';
import { keepStorage } from './persist';
import { isDay } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';

const OPSLAG = 'concordans:mappen';
const EERSTE = 'Losse markeringen';
/** The name a shared Losse markeringen gets with its receiver, beside their own. */
const SHARED_LOOSE = 'Gedeelde markeringen';
/** The bundel the readers keep in this browser session, until it is ended (`keepIn`). */
const KEEPING = 'concordans:bewaar-in';

/** The bundel kept in this session; none where the browser keeps no session. */
function keepingNow(): string | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEEPING);
	} catch (e) {
		if (import.meta.env.DEV) console.debug('sessionStorage (refused):', e);
		return null;
	}
}

type Stand = { mappen: Map[] };

const nu = () => new Date().toISOString();
const nieuwId = () => Math.random().toString(36).slice(2, 10);
const leeg = (naam: string): Map => ({
	id: nieuwId(),
	naam,
	items: [],
	volgorde: 'groep',
	gewijzigd: nu()
});

/** A day as kept (`2026-10-12`), else none. */
const day = (v: unknown) => (typeof v === 'string' && isDay(v) ? v : null);

/** The bundels visited in this browser session, by id: a reload is no new visit. */
const VISITED = 'concordans:bundels-bezocht';

/** The bundels visited in this session; none where the browser keeps no session. */
function visitedNow(): Set<string> {
	try {
		return new Set(JSON.parse(sessionStorage.getItem(VISITED) ?? '[]'));
	} catch (e) {
		if (import.meta.env.DEV) console.debug('sessionStorage (refused):', e);
		return new Set();
	}
}

/** The notes per group as kept, strings only. */
const alleenTekst = (v: unknown): GroepNotities =>
	v && typeof v === 'object'
		? Object.fromEntries(
				Object.entries(v).filter(([, n]) => typeof n === 'string' && n.trim()) as [string, string][]
			)
		: {};

/** The items of a bundel this version cannot read, by the bundel's id, as they were kept:
 *  written back with it unchanged, never thrown away (a newer version may read them). */
let onleesbaar: Record<string, unknown[]> = {};
let gemeld = false;

/** The items kept in this browser that are whole; the rest kept aside for the write, and said. */
function heleItems(id: string, v: unknown): MapItem[] {
	if (!Array.isArray(v)) return [];
	const items: MapItem[] = [];
	const rest: unknown[] = [];
	for (const i of v) {
		const item = readItem(i);
		if (item) items.push(item);
		else rest.push(i);
	}
	if (rest.length) {
		onleesbaar[id] = rest;
		if (!gemeld)
			console.warn(
				`Bundels: ${formatCount(rest.length)} item(s) in deze browser niet te lezen, wel bewaard.`
			);
		gemeld = true;
	}
	return items;
}

/** Losse markeringen alone: where this browser keeps none, or none it can read. */
const eersteStand = (): Stand => ({ mappen: [leeg(EERSTE)] });

/** The bundels as this browser keeps them now; null where it keeps none it can read. */
function lees(): Stand | null {
	try {
		const raw = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null');
		if (!raw || !Array.isArray(raw.mappen) || !raw.mappen.length) return null;
		onleesbaar = {};
		// The first is Losse markeringen by its place, whatever name it was kept under.
		const mappen: Map[] = raw.mappen.map((m: Map, n: number) => ({
			id: String(m.id),
			naam: n === 0 ? EERSTE : String(m.naam || 'Bundel'),
			items: heleItems(String(m.id), m.items),
			volgorde: m.volgorde === 'eigen' ? 'eigen' : 'groep',
			gewijzigd: String(m.gewijzigd || nu()),
			notitie: typeof m.notitie === 'string' && m.notitie.trim() ? m.notitie : null,
			groepNotities: alleenTekst(m.groepNotities),
			since: day(m.since),
			seen: day(m.seen)
		}));
		return { mappen };
	} catch {
		return null;
	}
}

class Kaarten {
	#stand = $state<Stand>((typeof window === 'undefined' ? null : lees()) ?? eersteStand());
	constructor() {
		// What another tab kept comes in at once (the browser's storage event).
		if (typeof window !== 'undefined')
			window.addEventListener('storage', (e) => {
				if (e.key === OPSLAG || e.key === null) this.#vers();
			});
	}
	/** Every change starts from what this browser keeps now, not from this tab's copy: a tab
	 *  opened before never undoes what another kept since (Thijs, 20 Oct: a bundel emptied). */
	#vers() {
		if (typeof window === 'undefined') return;
		const kept = lees();
		if (kept) this.#stand = kept;
	}
	mappen = $derived(this.#stand.mappen);
	/** Losse markeringen, where Bewaar keeps. */
	loose = $derived(this.#stand.mappen[0]);
	/** The bundels as the overview lists them: Losse markeringen first, then last changed first. */
	listed = $derived([
		this.#stand.mappen[0],
		...this.#stand.mappen.slice(1).sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd))
	]);
	/** Losse markeringen: the first bundel, emptied but never deleted. */
	isDefault = (m: Pick<Map, 'id'>) => m.id === this.#stand.mappen[0].id;
	/** The bundels that hold an item, in the order of the list. */
	holding = (i: Pick<MapItem, 'id' | 'at'>): Map[] =>
		this.listed.filter((m) => m.items.some((x) => itemKey(x) === itemKey(i)));
	/** Kept in any bundel. */
	heeft = (i: Pick<MapItem, 'id' | 'at'>) => this.holding(i).length > 0;

	#bewaar() {
		const mappen = this.#stand.mappen.map((m) =>
			onleesbaar[m.id] ? { ...m, items: [...m.items, ...onleesbaar[m.id]] } : m
		);
		try {
			localStorage.setItem(OPSLAG, JSON.stringify({ mappen }));
		} catch {
			/* geen opslag */
		}
	}
	/** Changes a map by its id and remembers. */
	#change(id: string, f: (m: Map) => Partial<Map>) {
		this.#vers();
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((m) => (m.id === id ? { ...m, ...f(m), gewijzigd: nu() } : m))
		};
		this.#bewaar();
	}

	// ── Items ─────────────────────────────────────────────────────────────────
	/** Bewaar: into a bundel, Losse markeringen where none is named; never out of one. Taking
	 *  a bron out is per bundel, by its tick (BundleChecklist), never all at once. */
	keep(i: MapItem, id: string = this.loose.id) {
		this.add(i, id);
	}
	#keeping = $state<string | null>(keepingNow());
	/** The bundel the readers keep in, named on Bewaar with a way back to it, from Andere bron
	 *  toevoegen on its page until the reader ends it or goes back to it (UX-toets A21 #1);
	 *  null: Bewaar keeps in Losse markeringen. */
	keeping = $derived(this.#stand.mappen.find((m) => m.id === this.#keeping) ?? null);
	/** Where Bewaar keeps now. */
	keepsIn = $derived(this.keeping ?? this.loose);
	/** Keeps in a bundel from now on in this session; null ends it. */
	keepIn(id: string | null) {
		this.#keeping = id;
		try {
			if (id) sessionStorage.setItem(KEEPING, id);
			else sessionStorage.removeItem(KEEPING);
		} catch (e) {
			if (import.meta.env.DEV) console.debug('sessionStorage (refused):', e);
		}
	}
	/** In a bundel or out of it, by its id: the bundels of Bewaar's menu. */
	toggleIn(id: string, i: MapItem) {
		if (this.holding(i).some((m) => m.id === id)) this.weg(i, id);
		else this.add(i, id);
	}
	/** Into a bundel by its id, once. */
	add(i: MapItem, id: string) {
		keepStorage();
		this.#change(id, (m) => ({ items: withItems(m.items, [i]) }));
	}
	weg(i: Pick<MapItem, 'id' | 'at'>, id: string) {
		const k = itemKey(i);
		this.#change(id, (m) => ({ items: m.items.filter((x) => itemKey(x) !== k) }));
	}
	/** All items out; the bundel stays. */
	empty(id: string) {
		this.#change(id, () => ({ items: [] }));
	}
	notitie(i: Pick<MapItem, 'id' | 'at'>, tekst: string, id: string) {
		const k = itemKey(i);
		const t = tekst.trim();
		this.#change(id, (m) => ({
			items: m.items.map((x) => (itemKey(x) === k ? { ...x, notitie: t || null } : x))
		}));
	}
	schuif(i: Pick<MapItem, 'id' | 'at'>, richting: -1 | 1, id: string) {
		this.#change(id, (m) => ({ items: verschuif(m.items, itemKey(i), richting, m.volgorde) }));
	}
	ordening(v: Map['volgorde'], id: string) {
		this.#change(id, () => ({ volgorde: v }));
	}
	/** The note on a group of the map, by its key; empty is none. */
	groepNotitie(sleutel: string, tekst: string, id: string) {
		const t = tekst.trim();
		this.#change(id, (m) => {
			const rest = { ...m.groepNotities };
			if (t) rest[sleutel] = t;
			else delete rest[sleutel];
			return { groepNotities: rest };
		});
	}
	/** The note on the map as a whole; empty is none. */
	mapNotitie(tekst: string, id: string) {
		const t = tekst.trim();
		this.#change(id, () => ({ notitie: t || null }));
	}

	/**
	 * A visit to a bundel's own page, on `today`: once a browser session the day of the visit
	 * before becomes the day new counts from, as Gevolgd counts a topic's. That day, or null
	 * on the first visit. Not a change of the bundel: its day of change stays.
	 */
	visit(id: string, today: string): string | null {
		this.#vers();
		const m = this.#stand.mappen.find((x) => x.id === id);
		if (!m) return null;
		const visited = visitedNow();
		if (visited.has(id)) return m.since ?? null;
		try {
			sessionStorage.setItem(VISITED, JSON.stringify([...visited, id]));
		} catch (e) {
			// Without a session every load is a visit: what is new counts from the load before.
			if (import.meta.env.DEV) console.debug('sessionStorage (refused):', e);
		}
		const since = m.seen ?? m.since ?? null;
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((x) => (x.id === id ? { ...x, since, seen: today } : x))
		};
		this.#bewaar();
		return since;
	}

	// ── Maps ─────────────────────────────────────────────────────────────────
	/** A new bundel; its name the next free `Bundel 2`, `Bundel 3` where none is given. */
	nieuw(naam?: string, items: MapItem[] = []): Map {
		this.#vers();
		const namen = new Set(this.#stand.mappen.map((m) => m.naam));
		let n = this.#stand.mappen.length + 1;
		while (!naam && namen.has(`Bundel ${n}`)) n++;
		// A name a bundel has already is numbered on: `Thuiswerk 2` beside `Thuiswerk`.
		const m = { ...leeg(naam?.trim() ? freeName(naam.trim(), namen) : `Bundel ${n}`), items };
		if (items.length) keepStorage();
		this.#stand = { mappen: [...this.#stand.mappen, m] };
		this.#bewaar();
		return m;
	}
	/** A new name; Losse markeringen keeps its own. */
	hernoem(id: string, naam: string) {
		this.#vers();
		const t = naam.trim();
		if (!t || this.isDefault({ id })) return;
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((m) => (m.id === id ? { ...m, naam: t, gewijzigd: nu() } : m))
		};
		this.#bewaar();
	}
	/** Gone for good; Losse markeringen stays (it is emptied instead). */
	verwijder(id: string) {
		this.#vers();
		if (this.isDefault({ id })) return;
		this.#stand = { mappen: this.#stand.mappen.filter((m) => m.id !== id) };
		this.#bewaar();
	}

	// ── A shared map (a link, a file) ─────────────────────────────────────
	/** Into a bundel, without doubles; its notes where the bundel has none. */
	voegToe(g: SharedMap, id: string) {
		keepStorage();
		this.#change(id, (m) => ({
			items: withItems(m.items, g.items),
			notitie: m.notitie || g.notitie,
			groepNotities: { ...g.groepNotities, ...m.groepNotities }
		}));
	}
	/** In place of a map: its id kept, its name, items, order and notes the shared one's. */
	replace(id: string, g: SharedMap) {
		keepStorage();
		this.#change(id, (m) => ({
			naam: g.naam ?? m.naam,
			items: [...g.items],
			volgorde: g.volgorde,
			notitie: g.notitie,
			groepNotities: { ...g.groepNotities }
		}));
	}
	/** As a bundel of its own, under its name, in its order, with its note; a shared Losse
	 *  markeringen (or a bundel without a name) as Gedeelde markeringen. */
	bewaarAlsMap(g: SharedMap): Map {
		const name = g.naam && g.naam !== EERSTE && g.naam !== this.loose.naam ? g.naam : SHARED_LOOSE;
		const m = this.nieuw(name, g.items);
		if (g.volgorde === 'eigen') this.ordening('eigen', m.id);
		if (g.notitie) this.mapNotitie(g.notitie, m.id);
		for (const [k, n] of Object.entries(g.groepNotities)) this.groepNotitie(k, n, m.id);
		return m;
	}
}

export const kaart = new Kaarten();
