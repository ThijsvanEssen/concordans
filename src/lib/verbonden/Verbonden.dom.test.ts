// The panel Verbonden in a page: the groups of the context and not of the kern, a row that
// opens its bron with the citation marked, a Kamerstuk that opens in place, and Exporteer
// with the rows of every group (code-eenvoud F95: before the panel is cut into parts).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { goto } from '$app/navigation';
import { fakeApi } from '$lib/test/fakeApi';
import { markeringVoor } from '$lib/bron/markering.svelte';
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import { download } from './export';
import { buildGroups } from './groups';
import { EMPTY_FILTER } from './filter';
import { DEFAULT_LOADER_OPTIONS } from './loaders';
import type { Row } from './rows';
import type { VerbondenState } from './source';
import Verbonden from './Verbonden.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/explore?bron=a') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('./export', async (eigen) => ({ ...(await eigen<object>()), download: vi.fn() }));

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

function state(): VerbondenState {
	const rows: Record<string, Row[]> = { judgments: [uitspraak], documents: [motie], law: [wet] };
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

function paneel() {
	const onAlles = vi.fn(async () => {});
	render(Verbonden, {
		verbonden: state(),
		selection,
		filter: EMPTY_FILTER,
		store: { nodes: readable([]) } as unknown as GraphStore,
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
		expect(meta).toEqual(['ECLI:NL:HR:2019:2006', 'herkend in de tekst']);
	});

	it('opens a judgment with one click on its row, at the note, the citation marked', async () => {
		paneel();
		await klik(
			screen.getByText('Hoge Raad, 20 december 2019').closest('li')!.querySelector('.row__meta')!
		);
		expect(goto).toHaveBeenCalledTimes(1);
		const href = String(vi.mocked(goto).mock.calls[0][0]);
		expect(href).toContain('ecli_nl_hr_2019_2006');
		expect(href).toContain('#fn-35');
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
});
