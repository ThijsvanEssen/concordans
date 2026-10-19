import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SharedMap, MapItem } from './map';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

const lid: MapItem = {
	id: 'articles/bwbr0005290_658',
	at: 'lid-1',
	kort: 'art. 7:658 lid 1 BW',
	groep: 'Burgerlijk Wetboek Boek 7',
	groupKey: 'wet:bwbr0005290'
};
const ro: MapItem = {
	id: 'judgments/ecli_nl_hr_2005_au3313',
	at: 'rov-3.4',
	kort: 'HR 11 november 2005, ECLI:NL:HR:2005:AU3313, r.o. 3.4',
	groep: 'HR 11 november 2005',
	groupKey: 'judgments/ecli_nl_hr_2005_au3313'
};
const fromFile: SharedMap = {
	naam: 'Werkgever',
	items: [ro],
	volgorde: 'eigen',
	notitie: 'Uit het bestand',
	groepNotities: {},
	skipped: 0
};

/** The store as a page opens it, with the browser's storage asked for as `persist`. */
async function store(persisted = false) {
	vi.resetModules();
	const persist = vi.fn(async () => true);
	vi.stubGlobal('navigator', { storage: { persisted: async () => persisted, persist } });
	const { kaart } = await import('./map.svelte');
	return { kaart, persist };
}

afterEach(() => vi.unstubAllGlobals());

describe('the bundels of this browser', () => {
	it('puts a bundel from a file in place of one: its id kept, the rest the file’s', async () => {
		const { kaart } = await store();
		const m = kaart.nieuw('Werkgever', [lid]);
		const other = kaart.nieuw('Ander');
		kaart.replace(m.id, fromFile);
		const now = kaart.mappen.find((x) => x.id === m.id)!;
		expect(now.items).toEqual([ro]);
		expect(now.naam).toBe('Werkgever');
		expect(now.volgorde).toBe('eigen');
		expect(now.notitie).toBe('Uit het bestand');
		// The bundel kept in stays where it was, not the active one.
		expect(kaart.actief.id).toBe(other.id);
	});

	it('adds a bundel from a file to the one chosen, without doubles', async () => {
		const { kaart } = await store();
		const m = kaart.nieuw('Werkgever', [lid]);
		kaart.nieuw('Ander');
		kaart.voegToe({ ...fromFile, items: [lid, ro] }, m.id);
		expect(kaart.mappen.find((x) => x.id === m.id)!.items).toEqual([lid, ro]);
	});

	it('asks the browser to keep its storage when something is first kept, not on loading', async () => {
		const { kaart, persist } = await store();
		expect(persist).not.toHaveBeenCalled();
		kaart.wissel(lid);
		kaart.wissel(ro);
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
	});

	it('does not ask again where the storage is kept already', async () => {
		const { kaart, persist } = await store(true);
		kaart.wissel(lid);
		await new Promise((r) => setTimeout(r));
		expect(persist).not.toHaveBeenCalled();
	});
});

describe('a visit to a bundel’s own page', () => {
	/** A browser session's storage. */
	function session() {
		const kept = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (k: string) => kept.get(k) ?? null,
			setItem: (k: string, v: string) => kept.set(k, v)
		});
		return kept;
	}

	it('counts what is new from the visit before, once a session', async () => {
		const { kaart } = await store();
		const m = kaart.nieuw('Werkgever', [lid]);
		const changed = kaart.mappen.find((x) => x.id === m.id)!.gewijzigd;
		session();
		// The first visit: nothing to count from.
		expect(kaart.visit(m.id, '2026-10-12')).toBeNull();
		// A reload in the same session counts from the same day.
		expect(kaart.visit(m.id, '2026-10-12')).toBeNull();
		// A new session: from the visit before.
		session();
		expect(kaart.visit(m.id, '2026-10-19')).toBe('2026-10-12');
		expect(kaart.visit(m.id, '2026-10-19')).toBe('2026-10-12');
		session();
		expect(kaart.visit(m.id, '2026-10-20')).toBe('2026-10-19');
		// A visit is no change of the bundel.
		expect(kaart.mappen.find((x) => x.id === m.id)!.gewijzigd).toBe(changed);
	});
});
