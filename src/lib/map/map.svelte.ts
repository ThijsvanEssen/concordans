// The bundels as the page holds them, in this browser: each with a name; the first, Losse
// markeringen, always there (it is emptied, never deleted); one where Bewaar keeps, the one
// chosen last (`actief`). A bundel is changed by its id: working in one does not choose it.
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

type Stand = { mappen: Map[]; actief: string };

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

/** One empty map, active: where this browser keeps none, or none it can read. */
function eersteStand(): Stand {
	const eerste = leeg(EERSTE);
	return { mappen: [eerste], actief: eerste.id };
}

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
			const actief = mappen.some((m) => m.id === raw.actief) ? raw.actief : mappen[0].id;
			return { mappen, actief };
		}
		return eersteStand();
	} catch {
		return eersteStand();
	}
}

class Kaarten {
	#stand = $state<Stand>(typeof window === 'undefined' ? eersteStand() : lees());
	mappen = $derived(this.#stand.mappen);
	actief = $derived(
		this.#stand.mappen.find((m) => m.id === this.#stand.actief) ?? this.#stand.mappen[0]
	);
	items = $derived(this.actief.items);
	/** The bundels as the overview lists them: Losse markeringen first, then last changed first. */
	listed = $derived([
		this.#stand.mappen[0],
		...this.#stand.mappen.slice(1).sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd))
	]);
	/** Losse markeringen: the first bundel, emptied but never deleted. */
	isDefault = (m: Pick<Map, 'id'>) => m.id === this.#stand.mappen[0].id;
	sleutels = $derived(new Set(this.items.map(itemKey)));

	heeft = (i: Pick<MapItem, 'id' | 'at'>) => this.sleutels.has(itemKey(i));
	/** The item as the active map holds it, with its note. */
	vind = (i: Pick<MapItem, 'id' | 'at'>) =>
		this.items.find((x) => itemKey(x) === itemKey(i)) ?? null;

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

	// ── Items in the active map ───────────────────────────────────────────────
	/** Kept, or no longer: what a box beside a lid or a row does. */
	wissel(i: MapItem) {
		const k = itemKey(i);
		if (!this.heeft(i)) keepStorage();
		this.#change(this.actief.id, (m) => ({
			items: m.items.some((x) => itemKey(x) === k)
				? m.items.filter((x) => itemKey(x) !== k)
				: [...m.items, i]
		}));
	}
	weg(i: Pick<MapItem, 'id' | 'at'>, id = this.actief.id) {
		const k = itemKey(i);
		this.#change(id, (m) => ({ items: m.items.filter((x) => itemKey(x) !== k) }));
	}
	/** All items out; the bundel stays. */
	empty(id = this.actief.id) {
		this.#change(id, () => ({ items: [] }));
	}
	notitie(i: Pick<MapItem, 'id' | 'at'>, tekst: string, id = this.actief.id) {
		const k = itemKey(i);
		const t = tekst.trim();
		this.#change(id, (m) => ({
			items: m.items.map((x) => (itemKey(x) === k ? { ...x, notitie: t || null } : x))
		}));
	}
	schuif(i: Pick<MapItem, 'id' | 'at'>, richting: -1 | 1, id = this.actief.id) {
		this.#change(id, (m) => ({ items: verschuif(m.items, itemKey(i), richting, m.volgorde) }));
	}
	ordening(v: Map['volgorde'], id = this.actief.id) {
		this.#change(id, () => ({ volgorde: v }));
	}
	/** The note on a group of the map, by its key; empty is none. */
	groepNotitie(sleutel: string, tekst: string, id = this.actief.id) {
		const t = tekst.trim();
		this.#change(id, (m) => {
			const rest = { ...m.groepNotities };
			if (t) rest[sleutel] = t;
			else delete rest[sleutel];
			return { groepNotities: rest };
		});
	}
	/** The note on the map as a whole; empty is none. */
	mapNotitie(tekst: string, id = this.actief.id) {
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
	kies(id: string) {
		if (!this.#stand.mappen.some((m) => m.id === id)) return;
		this.#stand = { ...this.#stand, actief: id };
		this.#bewaar();
	}
	/** A new map, active from now on; its name the next free `Bundel 2`, `Bundel 3` where none given. */
	nieuw(naam?: string, items: MapItem[] = []): Map {
		const namen = new Set(this.#stand.mappen.map((m) => m.naam));
		let n = this.#stand.mappen.length + 1;
		while (!naam && namen.has(`Bundel ${n}`)) n++;
		// A name a bundel has already is numbered on: `Thuiswerk 2` beside `Thuiswerk`.
		const m = { ...leeg(naam?.trim() ? freeName(naam.trim(), namen) : `Bundel ${n}`), items };
		if (items.length) keepStorage();
		this.#stand = { mappen: [...this.#stand.mappen, m], actief: m.id };
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
		const mappen = this.#stand.mappen.filter((m) => m.id !== id);
		const actief = mappen.some((m) => m.id === this.#stand.actief)
			? this.#stand.actief
			: mappen[0].id;
		this.#stand = { mappen, actief };
		this.#bewaar();
	}

	/** Kept in another map (`in …` beside Bewaar): that map active from now on, the item in it. */
	bewaarIn(id: string, i: MapItem) {
		this.kies(id);
		if (!this.heeft(i)) this.wissel(i);
	}

	// ── A shared map (a link, a file) ─────────────────────────────────────
	/** Into a map (the active one where none is named), without doubles; its notes where the
	 *  map has none. */
	voegToe(g: SharedMap, id = this.actief.id) {
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
	/** As a map of its own, under its name, in its order, with its note. */
	bewaarAlsMap(g: SharedMap): Map {
		const m = this.nieuw(g.naam ?? undefined, g.items);
		if (g.volgorde === 'eigen') this.ordening('eigen', m.id);
		if (g.notitie) this.mapNotitie(g.notitie, m.id);
		for (const [k, n] of Object.entries(g.groepNotities)) this.groepNotitie(k, n, m.id);
		return m;
	}
}

export const kaart = new Kaarten();
