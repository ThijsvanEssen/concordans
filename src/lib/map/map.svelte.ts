// The maps as the page holds them, in this browser: each with a name, one active, where a box
// keeps what is chosen; the panel open or not; a map someone shared (?map=) until it is kept
// or put aside. The one map of step 1 (concordans:map) becomes the first map, untouched.
import { samen, sleutelVan, verschuif, type Gedeeld, type Map, type MapItem } from './map';

const OPSLAG = 'concordans:mappen';
const OUD = 'concordans:map';
const EERSTE = 'Gemarkeerd';

type Stand = { mappen: Map[]; actief: string };
export type { Gedeeld };

const nu = () => new Date().toISOString();
const nieuwId = () => Math.random().toString(36).slice(2, 10);
const leeg = (naam: string): Map => ({
	id: nieuwId(),
	naam,
	items: [],
	volgorde: 'groep',
	gewijzigd: nu()
});

const isItem = (i: unknown): i is MapItem =>
	!!i &&
	typeof (i as MapItem).id === 'string' &&
	typeof (i as MapItem).kort === 'string' &&
	typeof (i as MapItem).groep === 'string';

function lees(): Stand {
	try {
		const raw = JSON.parse(localStorage.getItem(OPSLAG) ?? 'null');
		if (raw && Array.isArray(raw.mappen) && raw.mappen.length) {
			const mappen: Map[] = raw.mappen.map((m: Map) => ({
				id: String(m.id),
				naam: String(m.naam || EERSTE),
				items: Array.isArray(m.items) ? m.items.filter(isItem) : [],
				volgorde: m.volgorde === 'eigen' ? 'eigen' : 'groep',
				gewijzigd: String(m.gewijzigd || nu()),
				notitie: typeof m.notitie === 'string' && m.notitie.trim() ? m.notitie : null
			}));
			const actief = mappen.some((m) => m.id === raw.actief) ? raw.actief : mappen[0].id;
			return { mappen, actief };
		}
		// Step 1 kept one map: it is the first, with all it holds.
		const oud = JSON.parse(localStorage.getItem(OUD) ?? '[]');
		const eerste = { ...leeg(EERSTE), items: Array.isArray(oud) ? oud.filter(isItem) : [] };
		return { mappen: [eerste], actief: eerste.id };
	} catch {
		const eerste = leeg(EERSTE);
		return { mappen: [eerste], actief: eerste.id };
	}
}

class Kaarten {
	#stand = $state<Stand>(
		typeof window === 'undefined'
			? (() => {
					const m = leeg(EERSTE);
					return { mappen: [m], actief: m.id };
				})()
			: lees()
	);
	mappen = $derived(this.#stand.mappen);
	actief = $derived(
		this.#stand.mappen.find((m) => m.id === this.#stand.actief) ?? this.#stand.mappen[0]
	);
	items = $derived(this.actief.items);
	sleutels = $derived(new Set(this.items.map(sleutelVan)));

	heeft = (i: Pick<MapItem, 'id' | 'at'>) => this.sleutels.has(sleutelVan(i));
	/** The item as the active map holds it, with its note. */
	vind = (i: Pick<MapItem, 'id' | 'at'>) =>
		this.items.find((x) => sleutelVan(x) === sleutelVan(i)) ?? null;

	#bewaar() {
		try {
			localStorage.setItem(OPSLAG, JSON.stringify(this.#stand));
			localStorage.removeItem(OUD);
		} catch {
			/* geen opslag */
		}
	}
	/** Changes the active map and remembers. */
	#werk(f: (m: Map) => Partial<Map>) {
		const id = this.actief.id;
		this.#stand = {
			...this.#stand,
			mappen: this.#stand.mappen.map((m) => (m.id === id ? { ...m, ...f(m), gewijzigd: nu() } : m))
		};
		this.#bewaar();
	}

	// ── Items in the active map ───────────────────────────────────────────────
	/** Kept, or no longer: what a box beside a lid or a row does. */
	wissel(i: MapItem) {
		const k = sleutelVan(i);
		this.#werk((m) => ({
			items: m.items.some((x) => sleutelVan(x) === k)
				? m.items.filter((x) => sleutelVan(x) !== k)
				: [...m.items, i]
		}));
	}
	weg(i: Pick<MapItem, 'id' | 'at'>) {
		const k = sleutelVan(i);
		this.#werk((m) => ({ items: m.items.filter((x) => sleutelVan(x) !== k) }));
	}
	wis() {
		this.#werk(() => ({ items: [] }));
	}
	notitie(i: Pick<MapItem, 'id' | 'at'>, tekst: string) {
		const k = sleutelVan(i);
		const t = tekst.trim();
		this.#werk((m) => ({
			items: m.items.map((x) => (sleutelVan(x) === k ? { ...x, notitie: t || null } : x))
		}));
	}
	schuif(i: Pick<MapItem, 'id' | 'at'>, richting: -1 | 1) {
		this.#werk((m) => ({ items: verschuif(m.items, sleutelVan(i), richting, m.volgorde) }));
	}
	ordening(v: Map['volgorde']) {
		this.#werk(() => ({ volgorde: v }));
	}
	/** The note on the map as a whole; empty is none. */
	mapNotitie(tekst: string) {
		const t = tekst.trim();
		this.#werk(() => ({ notitie: t || null }));
	}

	// ── Maps ─────────────────────────────────────────────────────────────────
	kies(id: string) {
		if (!this.#stand.mappen.some((m) => m.id === id)) return;
		this.#stand = { ...this.#stand, actief: id };
		this.#bewaar();
	}
	/** A new map, active from now on; its name the next free `Map 2`, `Map 3` where none given. */
	nieuw(naam?: string, items: MapItem[] = []): Map {
		const namen = new Set(this.#stand.mappen.map((m) => m.naam));
		let n = this.#stand.mappen.length + 1;
		while (!naam && namen.has(`Map ${n}`)) n++;
		const m = { ...leeg(naam?.trim() || `Map ${n}`), items };
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
	/** Gone for good; the last map stays, emptied. */
	verwijder(id: string) {
		const rest = this.#stand.mappen.filter((m) => m.id !== id);
		const mappen = rest.length ? rest : [leeg(EERSTE)];
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

	// ── A shared map (a link, ?map=) ─────────────────────────────────────────
	/** Into the active map, without doubles; its note where the map has none. */
	voegToe(g: Gedeeld) {
		this.#werk((m) => ({ items: samen(m.items, g.items), notitie: m.notitie || g.notitie }));
	}
	/** As a map of its own, under its name, in its order, with its note. */
	bewaarAlsMap(g: Gedeeld) {
		this.nieuw(g.naam ?? undefined, g.items);
		if (g.volgorde === 'eigen') this.ordening('eigen');
		if (g.notitie) this.mapNotitie(g.notitie);
	}
}

export const kaart = new Kaarten();
