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

describe('Losse markeringen, the bundel every browser has (decision 19)', () => {
	it('is the first bundel, under its own name, where Bewaar keeps at first', async () => {
		const { kaart } = await store();
		expect(kaart.mappen.map((m) => m.naam)).toEqual(['Losse markeringen']);
		expect(kaart.isDefault(kaart.mappen[0])).toBe(true);
		expect(kaart.actief.id).toBe(kaart.mappen[0].id);
	});

	it('cannot be deleted, only emptied and renamed', async () => {
		const { kaart } = await store();
		const first = kaart.mappen[0];
		kaart.wissel(lid);
		kaart.verwijder(first.id);
		expect(kaart.mappen.map((m) => m.id)).toEqual([first.id]);
		kaart.empty(first.id);
		expect(kaart.mappen[0].items).toEqual([]);
		kaart.hernoem(first.id, 'Los');
		expect(kaart.mappen[0].naam).toBe('Los');
		expect(kaart.isDefault(kaart.mappen[0])).toBe(true);
	});

	it('changes a bundel by its id, without moving where Bewaar keeps', async () => {
		const { kaart } = await store();
		const first = kaart.mappen[0];
		const other = kaart.nieuw('Thuiswerk', [lid, ro]);
		kaart.kies(first.id);
		kaart.notitie(lid, 'zorgplicht', other.id);
		kaart.mapNotitie('Vraag', other.id);
		kaart.groepNotitie('wet:bwbr0005290', 'Boek 7', other.id);
		kaart.schuif(ro, -1, other.id);
		kaart.ordening('eigen', other.id);
		kaart.weg(lid, other.id);
		const now = kaart.mappen.find((m) => m.id === other.id)!;
		expect(now.items).toEqual([ro]);
		expect(now.notitie).toBe('Vraag');
		expect(now.groepNotities).toEqual({ 'wet:bwbr0005290': 'Boek 7' });
		expect(now.volgorde).toBe('eigen');
		expect(kaart.actief.id).toBe(first.id);
	});

	it('lists Losse markeringen first, then the bundels last changed first', async () => {
		const { kaart } = await store();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-18T10:00:00Z'));
		const a = kaart.nieuw('A');
		vi.setSystemTime(new Date('2026-10-19T10:00:00Z'));
		const b = kaart.nieuw('B');
		vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
		kaart.mapNotitie('nieuw', a.id);
		vi.useRealTimers();
		expect(kaart.listed.map((m) => m.naam)).toEqual(['Losse markeringen', 'A', 'B']);
		expect(b.naam).toBe('B');
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
