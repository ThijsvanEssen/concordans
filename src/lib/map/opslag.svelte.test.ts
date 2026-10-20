// The bundels as this browser keeps them (localStorage): what was kept is read back whole,
// whatever form of before it was kept in, and never lost on a write: not by an item this
// version cannot read, not by a second tab that read the bundels before (Thijs, 20 Oct: a
// bundel with items showed none).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapItem } from './map';
import kept20Oct from './fixtures/opslag-20261020.json';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

const OPSLAG = 'concordans:mappen';

/** One browser's storage, shared by its tabs. */
function browser() {
	const data = new Map<string, string>();
	const listeners = new Set<(e: { key: string | null; newValue: string | null }) => void>();
	const storage = {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
	return { data, storage, listeners };
}

/** A tab of the browser: the store as a page opens it, its own copy in memory. */
async function tab(b: ReturnType<typeof browser>) {
	vi.resetModules();
	const own = new Set<(e: { key: string | null; newValue: string | null }) => void>();
	vi.stubGlobal('localStorage', b.storage);
	vi.stubGlobal('sessionStorage', browser().storage);
	vi.stubGlobal('navigator', {
		storage: { persisted: async () => true, persist: async () => true }
	});
	vi.stubGlobal('window', {
		addEventListener: (
			type: string,
			f: (e: { key: string | null; newValue: string | null }) => void
		) => {
			if (type === 'storage') own.add(f);
		}
	});
	const { kaart } = await import('./map.svelte');
	b.listeners.add((e) => own.forEach((f) => f(e)));
	return kaart;
}

/** What another tab wrote, as the browser tells this one (the `storage` event). */
function written(b: ReturnType<typeof browser>, value: string) {
	b.data.set(OPSLAG, value);
	b.listeners.forEach((f) => f({ key: OPSLAG, newValue: value }));
}

afterEach(() => vi.unstubAllGlobals());

const artikel: MapItem = {
	id: 'articles/bwbr0005289_162',
	at: '',
	kort: 'art. 6:162 BW',
	groep: 'Burgerlijk Wetboek Boek 6',
	groupKey: 'wet:bwbr0005289',
	pad: '/wetten/BWBR0005289/artikel/6:162'
};
const lid: MapItem = { ...artikel, at: 'lid-2', kort: 'art. 6:162 lid 2 BW' };
const uitspraak: MapItem = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	at: '',
	kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006',
	groep: 'HR 20 december 2019',
	groupKey: 'judgments/ecli_nl_hr_2019_2006'
};
const ro: MapItem = { ...uitspraak, at: 'rov-5.7.1', kort: `${uitspraak.kort}, r.o. 5.7.1` };
const dossier: MapItem = {
	id: 'dossiers/36665',
	at: '',
	kort: 'Kamerstukken 36665',
	voluit: 'Kamerstukken 36665 (Cyberbeveiligingswet)',
	groep: 'Cyberbeveiligingswet',
	groupKey: 'dossier:36665'
};
const stuk: MapItem = {
	id: 'documents/kst-36665-3',
	at: '',
	kort: 'Kamerstukken II 2024/25, 36665, nr. 3',
	groep: 'Cyberbeveiligingswet',
	groupKey: 'dossier:36665',
	notitie: 'MvT over de zorgplicht',
	pad: '/kamerstukken/36665/3'
};
const items = [artikel, lid, uitspraak, ro, dossier, stuk];

/** The bundels as the version before Bundels kept them (aed58f8d~1): one active. */
const voorBundels = JSON.stringify({
	actief: 'cbw',
	mappen: [
		{
			id: 'eerste',
			naam: 'Gemarkeerd',
			items: [],
			volgorde: 'groep',
			gewijzigd: '2026-10-15T09:00:00.000Z'
		},
		{
			id: 'cbw',
			naam: 'Wet en dossier',
			items,
			volgorde: 'groep',
			gewijzigd: '2026-10-19T16:00:00.000Z',
			notitie: 'Verhouding tot NIS2',
			groepNotities: { 'dossier:36665': 'Zorgplicht' }
		}
	]
});

describe('the bundels kept before Bundels (decision 19)', () => {
	it('reads every item back, the first bundel as Losse markeringen', async () => {
		const b = browser();
		b.data.set(OPSLAG, voorBundels);
		const kaart = await tab(b);
		expect(kaart.mappen.map((m) => m.naam)).toEqual(['Losse markeringen', 'Wet en dossier']);
		const cbw = kaart.mappen[1];
		expect(cbw.items).toEqual(items);
		expect(cbw.notitie).toBe('Verhouding tot NIS2');
		expect(cbw.groepNotities).toEqual({ 'dossier:36665': 'Zorgplicht' });
	});
});

describe('a reader’s bundels as kept on 20 Oct (live, after Bundels)', () => {
	it('shows every bundel with all it holds, the first as Losse markeringen', async () => {
		const b = browser();
		b.data.set(OPSLAG, JSON.stringify(kept20Oct));
		const kaart = await tab(b);
		expect(kaart.listed.map((m) => [m.naam, m.items.length])).toEqual([
			['Losse markeringen', 0],
			['Twee wetten en een memorie van toelichting', 5],
			['Een artikel', 1]
		]);
		// A write elsewhere leaves them as they were.
		kaart.keep(lid);
		const now = JSON.parse(b.data.get(OPSLAG)!);
		expect(now.mappen[1].items).toEqual(kept20Oct.mappen[1].items);
	});
});

describe('a write', () => {
	it('keeps an item this version cannot read as it was kept', async () => {
		const onbekend = { id: 'iets/met spatie', kort: 'Onbekend', toekomst: 1 };
		const b = browser();
		b.data.set(
			OPSLAG,
			JSON.stringify({
				mappen: [
					{
						id: 'eerste',
						naam: 'Losse markeringen',
						items: [],
						volgorde: 'groep',
						gewijzigd: '2026-10-15T09:00:00.000Z'
					},
					{
						id: 'x',
						naam: 'X',
						items: [artikel, onbekend],
						volgorde: 'groep',
						gewijzigd: '2026-10-15T09:00:00.000Z'
					}
				]
			})
		);
		const kaart = await tab(b);
		expect(kaart.mappen[1].items).toEqual([artikel]);
		kaart.add(uitspraak, 'x');
		const kept = JSON.parse(b.data.get(OPSLAG)!).mappen[1].items;
		expect(kept).toEqual([artikel, uitspraak, onbekend]);
	});

	it('in one tab never undoes what another tab kept', async () => {
		const b = browser();
		b.data.set(OPSLAG, voorBundels);
		const oud = await tab(b);
		const nieuw = await tab(b);
		nieuw.add(lid, nieuw.loose.id);
		written(b, b.data.get(OPSLAG)!);
		// The tab opened before keeps something, and visits the bundel.
		oud.keep(ro);
		oud.visit('cbw', '2026-10-20');
		const kept = JSON.parse(b.data.get(OPSLAG)!);
		expect(kept.mappen[0].items.map((i: MapItem) => i.kort)).toEqual([lid.kort, ro.kort]);
		expect(kept.mappen[1].items).toHaveLength(items.length);
		expect(oud.mappen[0].items).toHaveLength(2);
	});

	it('leaves its bundels as they are on a read of what it kept itself', async () => {
		// A bundel's page visits it in an effect that reads the bundels: a new copy on every
		// visit ran it again without end (effect_update_depth_exceeded, 20 Oct).
		const b = browser();
		b.data.set(OPSLAG, voorBundels);
		const kaart = await tab(b);
		kaart.visit('cbw', '2026-10-20');
		const mappen = kaart.mappen;
		kaart.visit('cbw', '2026-10-20');
		expect(kaart.mappen).toBe(mappen);
		// What another tab wrote since is read.
		written(b, voorBundels);
		kaart.visit('cbw', '2026-10-20');
		expect(kaart.mappen).not.toBe(mappen);
	});

	it('in one tab never undoes what another tab kept, without being told', async () => {
		// A browser that sends no storage event (or a tab asleep): the write starts from what
		// is kept, not from the tab's copy.
		const b = browser();
		b.data.set(OPSLAG, voorBundels);
		const oud = await tab(b);
		const nieuw = await tab(b);
		nieuw.add({ ...artikel, at: 'lid-3', kort: 'art. 6:162 lid 3 BW' }, 'cbw');
		oud.keep(ro);
		const kept = JSON.parse(b.data.get(OPSLAG)!);
		expect(kept.mappen[1].items).toHaveLength(items.length + 1);
		expect(kept.mappen[0].items.map((i: MapItem) => i.kort)).toEqual([ro.kort]);
	});
});

describe('a browser that keeps no bundels yet', () => {
	it('names Losse markeringen by one id: the same in every tab, the server’s page and after a reload', async () => {
		// UX-toets A28: the row linked to /bundels/<id> while the browser kept another id.
		const b = browser();
		const een = await tab(b);
		const ander = await tab(b);
		expect(ander.loose.id).toBe(een.loose.id);
		const link = een.loose.id;
		een.keep(lid);
		expect(JSON.parse(b.data.get(OPSLAG)!).mappen[0].id).toBe(link);
		// The bundel's page opens on that id, before a write and after it.
		const later = await tab(browser());
		expect(later.mappen.some((m) => m.id === link)).toBe(true);
		expect((await tab(b)).mappen.find((m) => m.id === link)?.items).toEqual([lid]);
	});

	it('keeps what two tabs keep in Losse markeringen, both', async () => {
		const b = browser();
		const een = await tab(b);
		const ander = await tab(b);
		een.keep(lid);
		ander.keep(ro);
		const kept = JSON.parse(b.data.get(OPSLAG)!);
		expect(kept.mappen).toHaveLength(1);
		expect(kept.mappen[0].items.map((i: MapItem) => i.kort)).toEqual([lid.kort, ro.kort]);
	});
});
