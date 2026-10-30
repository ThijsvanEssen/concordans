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
	kort: 'HR 11\u00a0november\u00a02005, ECLI:NL:HR:2005:AU3313, r.o. 3.4',
	groep: 'HR 11\u00a0november\u00a02005',
	groupKey: 'judgments/ecli_nl_hr_2005_au3313'
};
const fromFile: SharedMap = {
	naam: 'Werkgever',
	items: [ro],
	volgorde: 'eigen',
	notitie: 'Uit het bestand',
	groepNotities: {},
	aantekeningen: [],
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

const lookup = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/search', () => ({ lookup }));

describe('the references in a note (B62)', () => {
	it('asks the address of an abbreviation once, and keeps it with the bundel', async () => {
		lookup.mockResolvedValue({ props: { bwb_id: 'BWBR0001854', article_number: '98' } });
		const { kaart } = await store();
		const m = kaart.nieuw('Staat', [lid]);
		kaart.mapNotitie('# Vraag\nValt het onder art. 98 Sr of art. 6:162 BW?', m.id);
		await vi.waitFor(() =>
			expect(kaart.mappen.find((x) => x.id === m.id)?.references).toEqual({
				'artikel 98 sr': '/wetten/BWBR0001854/artikel/98'
			})
		);
		kaart.notitie(lid, 'Zie ook art. 98 Sr.', m.id);
		await Promise.resolve();
		expect(lookup).toHaveBeenCalledTimes(1);
	});
});

describe('the bundels of this browser', () => {
	it('puts a bundel from a file in place of one: its id kept, the rest the file’s', async () => {
		const { kaart } = await store();
		const m = kaart.nieuw('Werkgever', [lid]);
		kaart.nieuw('Ander');
		kaart.replace(m.id, fromFile);
		const now = kaart.mappen.find((x) => x.id === m.id)!;
		expect(now.items).toEqual([ro]);
		expect(now.naam).toBe('Werkgever');
		expect(now.volgorde).toBe('eigen');
		expect(now.notitie).toBe('Uit het bestand');
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
		kaart.keep(lid);
		kaart.keep(ro);
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
	});

	it('does not ask again where the storage is kept already', async () => {
		const { kaart, persist } = await store(true);
		kaart.keep(lid);
		await new Promise((r) => setTimeout(r));
		expect(persist).not.toHaveBeenCalled();
	});
});

describe('Mijn markeringen, the bundel every browser has (decision 19)', () => {
	it('is the first bundel, under its own name, where Bewaar keeps at first', async () => {
		const { kaart } = await store();
		expect(kaart.mappen.map((m) => m.naam)).toEqual(['Mijn markeringen']);
		expect(kaart.isDefault(kaart.mappen[0])).toBe(true);
		expect(kaart.loose.id).toBe(kaart.mappen[0].id);
	});

	it('cannot be deleted or renamed, only emptied', async () => {
		const { kaart } = await store();
		const first = kaart.mappen[0];
		kaart.keep(lid);
		kaart.verwijder(first.id);
		expect(kaart.mappen.map((m) => m.id)).toEqual([first.id]);
		kaart.empty(first.id);
		expect(kaart.mappen[0].items).toEqual([]);
		kaart.hernoem(first.id, 'Los');
		expect(kaart.mappen[0].naam).toBe('Mijn markeringen');
		expect(kaart.isDefault(kaart.mappen[0])).toBe(true);
	});

	it('changes a bundel by its id, without moving where Bewaar keeps', async () => {
		const { kaart } = await store();
		const first = kaart.mappen[0];
		const other = kaart.nieuw('Thuiswerk', [lid, ro]);
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
		expect(kaart.loose.id).toBe(first.id);
	});

	it('keeps with Bewaar in Mijn markeringen, and takes out only per bundel', async () => {
		const { kaart } = await store();
		const other = kaart.nieuw('Thuiswerk');
		kaart.keep(lid);
		expect(kaart.holding(lid).map((m) => m.naam)).toEqual(['Mijn markeringen']);
		// Bewaar again takes nothing out (UX-toets A14: nothing destructive in one click).
		kaart.keep(lid);
		expect(kaart.holding(lid)).toHaveLength(1);
		// Into a second bundel and out of one only by its tick.
		kaart.toggleIn(other.id, lid);
		expect(kaart.holding(lid)).toHaveLength(2);
		kaart.toggleIn(kaart.loose.id, lid);
		expect(kaart.holding(lid).map((m) => m.id)).toEqual([other.id]);
	});

	it('keeps in the bundel a reader was opened from, for the session, until it ends', async () => {
		const kept = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (k: string) => kept.get(k) ?? null,
			setItem: (k: string, v: string) => kept.set(k, v),
			removeItem: (k: string) => kept.delete(k)
		});
		const { kaart } = await store();
		const other = kaart.nieuw('Thuiswerk');
		expect(kaart.keepsIn.id).toBe(kaart.loose.id);
		kaart.keepIn(other.id);
		expect(kaart.keeping?.naam).toBe('Thuiswerk');
		expect(kaart.keepsIn.id).toBe(other.id);
		// Kept for the session: a reload keeps there still.
		expect([...kept.values()]).toEqual([other.id]);
		kaart.keepIn(null);
		expect(kaart.keepsIn.id).toBe(kaart.loose.id);
		expect(kept.size).toBe(0);
	});

	it('receives a shared Mijn markeringen under a name of its own', async () => {
		const { kaart } = await store();
		const shared = { ...fromFile, naam: 'Mijn markeringen' };
		expect(kaart.bewaarAlsMap(shared).naam).toBe('Gedeelde markeringen');
		expect(kaart.bewaarAlsMap({ ...shared, naam: null }).naam).toBe('Gedeelde markeringen 2');
		expect(kaart.bewaarAlsMap(fromFile).naam).toBe('Werkgever');
	});

	it('lists Mijn markeringen first, then the bundels last changed first', async () => {
		const { kaart } = await store();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-18T10:00:00Z'));
		const a = kaart.nieuw('A');
		vi.setSystemTime(new Date('2026-10-19T10:00:00Z'));
		const b = kaart.nieuw('B');
		vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
		kaart.mapNotitie('nieuw', a.id);
		vi.useRealTimers();
		expect(kaart.listed.map((m) => m.naam)).toEqual(['Mijn markeringen', 'A', 'B']);
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

describe('an arcering (O4, decision 24-1)', () => {
	const fragment = { waar: 'lid-1', exact: 'ernstige schade', start: 12 };

	it('keeps its place in the bundel of Bewaar, the bundel that holds it first', async () => {
		const { kaart } = await store();
		const ander = kaart.nieuw('Werkgever', [lid]);
		kaart.shade(lid, fragment);
		// The bundel that holds the lid, not Mijn markeringen.
		expect(kaart.loose.items).toEqual([]);
		const m = kaart.mappen.find((x) => x.id === ander.id)!;
		expect(m.aantekeningen).toEqual([
			{ id: expect.stringMatching(/^a-/), op: `${lid.id}#lid-1`, fragment }
		]);
	});

	it('takes a note, changes it, and goes away; its place stays kept', async () => {
		const { kaart } = await store();
		const a = kaart.shade(lid, fragment, 'Zorgplicht');
		const id = kaart.loose.id;
		expect(kaart.loose.aantekeningen?.[0].tekst).toBe('Zorgplicht');
		kaart.annotate(a, '', id);
		expect(kaart.loose.aantekeningen?.[0]).not.toHaveProperty('tekst');
		kaart.unshade(a, id);
		expect(kaart.loose.aantekeningen).toEqual([]);
		expect(kaart.loose.items).toEqual([lid]);
	});
});
