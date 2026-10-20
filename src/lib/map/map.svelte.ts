// The bundels as the page holds them, in this browser: each with a name; the first, Losse
// markeringen, always there (it is emptied, never deleted). Bewaar keeps in Losse
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

const OPSLAG = 'concordans:mappen';
const EERSTE = 'Losse markeringen';
/** The name a shared Losse markeringen gets with its receiver, beside their own. */
const SHARED_LOOSE = 'Gedeelde markeringen';

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

/** The items kept in this browser that are whole; the rest left out, and said. */
function heleItems(v: unknown): MapItem[] {
	if (!Array.isArray(v)) return [];
	const items = v.flatMap((i) => readItem(i) ?? []);
	const skipped = v.length - items.length;
	if (skipped > 0)
		console.warn(
			`Bundels: ${skipped} item(s) in deze browser overgeslagen (oude of onvolledige vorm).`
		);
	return items;
}

/** Losse markeringen alone: where this browser keeps none, or none it can read. */
const eersteStand = (): Stand => ({ mappen: [leeg(EERSTE)] });

function lees(): Stand {
	try {
		const raw = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null');
		if (raw && Array.isArray(raw.mappen) && raw.mappen.length) {
			const mappen: Map[] = raw.mappen.map((m: Map) => ({
				id: String(m.id),
				naam: String(m.naam || EERSTE),
				items: heleItems(m.items),
				volgorde: m.volgorde === 'eigen' ? 'eigen' : 'groep',
				gewijzigd: String(m.gewijzigd || nu()),
				notitie: typeof m.notitie === 'string' && m.notitie.trim() ? m.notitie : null,
				groepNotities: alleenTekst(m.groepNotities),
				since: day(m.since),
				seen: day(m.seen)
			}));
			return { mappen };
		}
		return eersteStand();
	} catch {
		return eersteStand();
	}
}

class Kaarten {
	#stand = $state<Stand>(typeof window === 'undefined' ? eersteStand() : lees());
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
		try {
			localStorage.setItem(OPSLAG, JSON.stringify(this.#stand));
		} catch {
			/* geen opslag */
		}
	}
	/** Changes a map by its id and remembers. */
	#change(id: string, f: (m: Map) => Partial<Map>) {
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((m) => (m.id === id ? { ...m, ...f(m), gewijzigd: nu() } : m))
		};
		this.#bewaar();
	}

	// ── Items ─────────────────────────────────────────────────────────────────
	/** Bewaar, or Bewaard: kept in Losse markeringen where no bundel holds it, else taken out
	 *  of every bundel that holds it (Bewaard names them). */
	wissel(i: MapItem) {
		const held = this.holding(i);
		if (!held.length) return this.add(i, this.loose.id);
		for (const m of held) this.weg(i, m.id);
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
	hernoem(id: string, naam: string) {
		const t = naam.trim();
		if (!t) return;
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((m) => (m.id === id ? { ...m, naam: t, gewijzigd: nu() } : m))
		};
		this.#bewaar();
	}
	/** Gone for good; Losse markeringen stays (it is emptied instead). */
	verwijder(id: string) {
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
