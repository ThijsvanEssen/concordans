// The panel Verbonden in a page: the groups of the context and not of the kern, a row that
// opens its bron with the citation marked, a Kamerstuk that opens in place, and Exporteer
// with the rows of every group (code-eenvoud F95: before the panel is cut into parts).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import { fakeApi } from '$lib/test/fakeApi';
import { markeringVoor } from '$lib/bron/markering.svelte';
import type { GraphNode } from '$lib/graph/types';
import { download } from '$lib/util/save-file';
import { buildGroups } from './groups';
import { EMPTY_FILTER } from './filter';
import { DEFAULT_LOADER_OPTIONS } from './loaders';
import type { Row } from './rows';
import type { VerbondenState } from './data-source';
import Verbonden from './Verbonden.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/explore?bron=a') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/util/save-file', async (eigen) => ({
	...(await eigen<object>()),
	download: vi.fn()
}));

const uitspraak: Row = {
	ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_2006' },
	title: 'Hoge Raad, 20 december 2019',
	context: null,
	filterGroup: 'uitspraken',
	identifier: 'ECLI:NL:HR:2019:2006',
	lid: '2',
	at: 'rov-5.7.6',
	position: 'r.o. 5.7.6 (voetnoot 35)',
	passageAt: 'rov-5.7.6',
	noot: { id: 'fn-35', label: '35' },
	snippet: 'Zie artikel 6:162 BW over de onrechtmatige daad.',
	match: 'artikel 6:162 BW',
	relation: 'REFERS_TO',
	direction: 'inbound',
	confidence: 1
};

const motie: Row = {
	ref: { collection: 'documents', key: 'tk_36764_19' },
	title: 'Motie van het lid Kathmann over een meldportaal',
	context: 'Motie, Kamerstuk 36764, nr. 19',
	filterGroup: 'dossiers',
	date: '2026-03-23',
	relation: 'REFERS_TO',
	direction: 'inbound',
	props: { kind: 'Motie', dictum: 'verzoekt de regering één meldportaal in te richten' }
};

const wet: Row = {
	ref: { collection: 'instruments', key: 'bwbr0005289' },
	title: 'Burgerlijk Wetboek Boek 6',
	context: 'Wet',
	filterGroup: 'wetten',
	relation: 'PART_OF',
	direction: 'outbound'
};

const selection = {
	id: 'articles/bwbr0005289_6_162',
	collection: 'articles',
	key: 'bwbr0005289_6_162',
	label: 'Artikel 6:162 BW'
} as GraphNode;

const ROWS: Record<string, Row[]> = { judgments: [uitspraak], documents: [motie], law: [wet] };

function state(rows: Record<string, Row[]> = ROWS): VerbondenState {
	return {
		id: selection.id,
		groups: buildGroups('articles', []).map((g) => ({
			...g,
			rows: rows[g.id] ?? [],
			total: rows[g.id]?.length ?? 0
		})),
		loading: false,
		failed: false,
		options: DEFAULT_LOADER_OPTIONS
	};
}

function paneel(rows: Record<string, Row[]> = ROWS, extra: Record<string, unknown> = {}) {
	const onAlles = vi.fn(async () => {});
	render(Verbonden, {
		...extra,
		verbonden: state(rows),
		selection,
		filter: EMPTY_FILTER,
		onFilter: () => {},
		onOpenFilter: () => {},
		tableHref: '/explore?tabel=1',
		onAlles
	});
	return { onAlles };
}

/** A plain click, which a link inside would follow: the window stops it once it is past. */
function klik(el: Element) {
	addEventListener('click', (e) => e.preventDefault(), { once: true });
	return fireEvent.click(el);
}

beforeEach(() => {
	vi.mocked(goto).mockReset();
	// A Kamerstuk opened in place asks its text: it never answers here.
	fakeApi({ '/api/documents/{key}': () => new Promise(() => {}) });
});

describe('Verbonden', () => {
	it('shows the groups of the context, not the wet of the kern above the text', () => {
		paneel();
		const koppen = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim());
		expect(koppen).toEqual([
			'Uitspraken die dit artikel aanhalen',
			'Kamerstukken die dit artikel noemen'
		]);
		expect(screen.queryByText('Burgerlijk Wetboek Boek 6')).toBeNull();
	});

	it('says each row: its title, its verbinding with the place, the passage and the meta line', () => {
		paneel();
		const rij = screen.getByText('Hoge Raad, 20 december 2019').closest('li')!;
		expect(rij.querySelector('.row__hoe')?.textContent).toBe(
			'Haalt aan lid 2, in r.o. 5.7.6 (voetnoot 35)'
		);
		expect(within(rij).getByRole('link', { name: 'r.o. 5.7.6 (voetnoot 35)' })).toBeTruthy();
		expect(rij.querySelector('.row__citaat')?.textContent).toContain('artikel 6:162 BW');
		// The comma's space is its margin (.row__sep).
		const meta = [...rij.querySelectorAll('.row__meta .row__part')].map((p) => p.textContent);
		// The ECLI short; the passage shows the verbinding is in the text, the words not again (A208c).
		expect(meta).toEqual(['HR:2019:2006']);
	});

	it('opens a judgment in place on one click on its row, the bron one step further', async () => {
		paneel();
		const li = screen.getByText('Hoge Raad, 20 december 2019').closest('li')!;
		await klik(li.querySelector('.row__meta')!);
		expect(goto).not.toHaveBeenCalled();
		expect(li.querySelector('.row__title')!.getAttribute('aria-expanded')).toBe('true');
		const verder = within(li.querySelector('.row__inhoud')! as HTMLElement).getByRole('link', {
			name: 'Lees verder'
		});
		const href = verder.getAttribute('href')!;
		expect(href).toContain('ecli_nl_hr_2019_2006');
		expect(href).toContain('#fn-35');
		await klik(verder);
		expect(markeringVoor('judgments/ecli_nl_hr_2019_2006', 'fn-35')).toMatchObject({
			doel: 'bwbr0005289_6_162'
		});
	});

	it('opens a Kamerstuk in place under its row, and closes it again', async () => {
		paneel();
		const titel = screen.getByRole('link', {
			name: 'Motie van het lid Kathmann over een meldportaal'
		});
		await klik(titel);
		expect(goto).not.toHaveBeenCalled();
		expect(titel.getAttribute('aria-expanded')).toBe('true');
		expect(titel.closest('li')!.querySelector('.row__inhoud')).not.toBeNull();
		await klik(titel);
		expect(titel.closest('li')!.querySelector('.row__inhoud')).toBeNull();
	});

	it('exports every row, the kern included, after asking for all of them', async () => {
		const { onAlles } = paneel();
		await klik(screen.getByRole('button', { name: 'Exporteer' }));
		await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
		expect(onAlles).toHaveBeenCalledTimes(1);
		const [naam, csv] = vi.mocked(download).mock.calls[0];
		expect(naam).toMatch(/\.csv$/);
		expect(csv).toContain('Hoge Raad, 20 december 2019');
		expect(csv).toContain('Motie van het lid Kathmann over een meldportaal');
		expect(csv).toContain('Burgerlijk Wetboek Boek 6');
	});

	// The artikel, the uitspraak and the Kamerstuk share this panel: one guard for all three.
	it('says of a bron without verbindingen only that, with no count, table or export', () => {
		paneel({});
		const paneelEl = screen.getByRole('complementary', { name: 'Verbonden' });
		expect(paneelEl.textContent).toContain('Geen verbindingen.');
		expect(paneelEl.textContent).not.toMatch(/\b0 verbindingen/);
		expect(screen.queryByText(/in een tabel/)).toBeNull();
		expect(screen.queryByRole('button', { name: /Exporteer/ })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
	});

	it('has Netwerk tonen in Tekst, and draws the network above the groups with a legend of one line', async () => {
		const onShowNetwork = vi.fn();
		paneel(ROWS, { onShowNetwork, showNetwork: false });
		await fireEvent.click(screen.getByRole('button', { name: 'Netwerk tonen' }));
		expect(onShowNetwork).toHaveBeenCalledWith(true);
		expect(screen.queryByTestId('network-sketch')).toBeNull();
	});

	it('draws each bron on its own up to forty, counted under the drawing', () => {
		paneel(ROWS, { onShowNetwork: () => {}, showNetwork: true, networkHref: '/x' });
		expect(screen.getByRole('button', { name: 'Netwerk verbergen' })).toBeTruthy();
		const figuur = screen.getByTestId('network-sketch');
		expect(figuur.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'2 bronnen'
		);
		const namen = [...figuur.querySelectorAll('.single title')].map((t) => t.textContent);
		expect(namen).toEqual([
			'Hoge Raad, 20 december 2019',
			'Motie van het lid Kathmann over een meldportaal'
		]);
		// A bron on its own is a button, no link; the middle is no link either (besluit 39).
		expect(figuur.querySelectorAll('a')).toHaveLength(0);
	});

	it('opens a bron of the drawing in place under it, its card; the werkplek is a link below', async () => {
		paneel(ROWS, { onShowNetwork: () => {}, showNetwork: true, networkHref: '/x?mode=netwerk' });
		const figuur = screen.getByTestId('network-sketch');
		const hr = figuur.querySelector<SVGElement>(
			'.single[aria-label="Hoge Raad, 20 december 2019"]'
		)!;
		await klik(hr);
		expect(goto).not.toHaveBeenCalled();
		expect(hr.getAttribute('aria-expanded')).toBe('true');
		const kaart = screen.getByRole('region', { name: 'Hoge Raad, 20 december 2019' });
		expect(kaart.querySelector('a.btn')?.textContent).toBe('Lees');
		expect(screen.getByRole('link', { name: 'Open in netwerk' }).getAttribute('href')).toBe(
			'/x?mode=netwerk'
		);
		await klik(hr);
		expect(screen.queryByRole('region', { name: 'Hoge Raad, 20 december 2019' })).toBeNull();
	});

	it('draws fewer bronnen on its own when the screen turns to a phone width', async () => {
		let matches = false;
		const listeners = new Set<() => void>();
		vi.stubGlobal('matchMedia', () => ({
			get matches() {
				return matches;
			},
			addEventListener: (_: string, fn: () => void) => listeners.add(fn),
			removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
		}));
		const veel = Array.from({ length: 14 }, (_, i) => ({
			...uitspraak,
			ref: { collection: 'judgments' as const, key: `ecli_${i}` },
			title: `Uitspraak ${i}`
		}));
		paneel({ judgments: veel }, { onShowNetwork: () => {}, showNetwork: true, networkHref: '/x' });
		const namen = () => screen.getByTestId('network-sketch').querySelectorAll('.single').length;
		expect(namen()).toBe(14);
		matches = true;
		listeners.forEach((fn) => fn());
		await tick();
		expect(namen()).toBe(0);
		vi.unstubAllGlobals();
	});

	it('has no Netwerk tonen beside the canvas', () => {
		paneel();
		expect(screen.queryByRole('button', { name: /Netwerk tonen/ })).toBeNull();
	});

	it('opens in Tekst on the soorten: a heading with its count, three titles with one line, Alle N', async () => {
		paneel(ROWS, { onShowNetwork: () => {}, showNetwork: false });
		const koppen = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim());
		expect(koppen).toEqual(['Uitspraken1', 'Stukken1']);
		// The passage and the ECLI wait for the row to open; no order at a glance, one Filter.
		expect(screen.queryByText(/HR:2019:2006/)).toBeNull();
		expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Datum' })).toBeNull();
		await klik(screen.getByRole('link', { name: 'Hoge Raad, 20 december 2019' }));
		expect(goto).not.toHaveBeenCalled();
		expect(screen.getByText(/HR:2019:2006/)).toBeTruthy();
	});

	it('opens a soort in place from Alle N, in the one view, and folds it with Minder (A208e)', async () => {
		paneel(
			{
				...ROWS,
				judgments: [
					uitspraak,
					{ ...uitspraak, ref: { collection: 'judgments', key: 'x' } },
					{ ...uitspraak, ref: { collection: 'judgments', key: 'y' } },
					{ ...uitspraak, ref: { collection: 'judgments', key: 'z' } }
				]
			},
			{ onShowNetwork: () => {}, showNetwork: false }
		);
		const kop = () =>
			screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim());
		expect(kop()).toEqual(['Uitspraken4', 'Stukken1']);
		await fireEvent.click(screen.getByRole('button', { name: 'Alle 4 uitspraken' }));
		// The same soorten stand: no second view, no Alle soorten or Indeling.
		expect(kop()).toEqual(['Uitspraken4', 'Stukken1']);
		expect(screen.queryByRole('button', { name: /Alle soorten|Indeling/ })).toBeNull();
		expect(document.querySelectorAll('[data-kind="judgments"] .kind__rows > li')).toHaveLength(4);
		await fireEvent.click(screen.getByRole('button', { name: 'Minder' }));
		expect(document.querySelectorAll('[data-kind="judgments"] .kind__rows > li')).toHaveLength(3);
	});
});
