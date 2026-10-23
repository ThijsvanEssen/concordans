// Bronnen as a reader meets it, list by list: what each address asks of the API, which
// filters it offers with which counts, how it sorts, what its rows and empty state say, and
// where a click takes it. The answers are the live API's, cut short (src/lib/test/bladeren.json).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { fail, fakeApi, type ApiPath, type FakeAnswer, type FakeRequest } from '$lib/test/fakeApi';
import { page, visit } from '$lib/test/page.svelte';
import live from '$lib/test/bladeren.json';
import IndexView from './IndexView.svelte';
import type { IndexCategory } from './index/categories';
// The addresses the API gives are kept as they come in, as src/hooks.ts has it in the app.
import '$lib/bron/kept-paths';

vi.mock('$app/state', async () => ({ page: (await import('$lib/test/page.svelte')).page }));
vi.mock('$app/navigation', async () => ({
	goto: (await import('$lib/test/page.svelte')).goto,
	afterNavigate: () => {},
	beforeNavigate: () => {}
}));

// A commitment is late by today's date.
beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});
afterAll(() => vi.useRealTimers());

type Faceted = { items: unknown[]; total: number | null; facets?: unknown };

/** A list that counts its facets apart: one row with the facets, else the rows. */
const list =
	(answer: Faceted) =>
	({ params }: FakeRequest) =>
		params.query?.facets
			? { ...answer, items: answer.items.slice(0, 1) }
			: { ...answer, facets: null };

const empty: Faceted = { items: [], total: 0, facets: {} };

const ROUTES: Partial<Record<ApiPath, FakeAnswer>> = {
	'/api/instruments': list(live.instruments),
	'/api/judgments': list(live.judgments),
	'/api/dossiers': list(live.dossiers),
	'/api/committees': live.committees,
	'/api/members': live.members,
	'/api/factions': live.factions,
	'/api/decisions': list(live.decisions),
	'/api/cabinets': live.cabinets,
	'/api/cabinets/{key}': live.cabinet,
	'/api/ministries': live.ministries,
	'/api/commitments': list(live.commitments),
	'/api/documents': list(live.documents),
	// The Tweede Kamer meets: the Stemmingen say no days without a sitting.
	'/api/feed/summary': {
		chamber_schedule: { last_sitting: null, last_votes: null, next_sitting: null, next_votes: null }
	},
	'/api/stats/coverage': live.coverage,
	// The EHRM off since 8 October: its list says how far it goes.
	'/api/stats': {
		data_as_of: {
			echr: {
				retrieved_at: '2026-10-08T20:53:06Z',
				newest: null,
				completeness: {
					source: { state: 'paused', as_of: '2026-10-08T20:53:06Z', missing: null }
				}
			}
		}
	},
	'/api/parties/colors': { colors: {}, aliases: {}, chambers: {} },
	// The hall of the Kamer is a picture of its own (Hemicycle, ZaalTegenover).
	'/api/parliament/seats': fail(503)
};

const text = (el: Element | null | undefined) =>
	(el?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function settled() {
	await waitFor(() =>
		expect(document.querySelector('.results')?.getAttribute('aria-busy')).toBe('false')
	);
	for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

/** The sort options, from the menu opened and closed again. */
async function sorts() {
	const knop = document.querySelector<HTMLElement>('button[aria-label^="Volgorde:"]');
	if (!knop) return null;
	await fireEvent.click(knop);
	const opties = [...document.querySelectorAll('[role="menuitemradio"]')].map(
		(o) => `${text(o)}${o.getAttribute('aria-checked') === 'true' ? ' (gekozen)' : ''}`
	);
	await fireEvent.click(knop);
	return opties;
}

/** What the reader sees: the choose-line, the filters, the list and its rows. */
async function view() {
	const zoek = document.querySelector<HTMLInputElement>('.regel input');
	return {
		zoek: {
			placeholder: zoek?.placeholder,
			waarde: zoek?.value,
			naam: zoek?.getAttribute('aria-label')
		},
		regel: text(document.querySelector('.regel')),
		filters: [...document.querySelectorAll('#bladeren-facetten button[aria-pressed]')].map(
			(b) => `${text(b)}${b.getAttribute('aria-pressed') === 'true' ? ' (aan)' : ''}`
		),
		facetten: text(document.getElementById('bladeren-facetten')),
		volgorde: await sorts(),
		richting:
			document.querySelector('.volgorde button:not([aria-haspopup])')?.getAttribute('aria-label') ??
			null,
		lijst: text(document.querySelector('.results')),
		rijen: [...document.querySelectorAll('.results a.row-title')].map(
			(a) => `${text(a)} -> ${a.getAttribute('href')}`
		),
		openbaar: document.querySelectorAll('.results [aria-expanded]').length
	};
}

/** Every request, per path, in the order asked. */
function asked(requests: FakeRequest[]) {
	const per: Record<string, unknown[]> = {};
	// What the client sends: a filter left undefined is no parameter.
	for (const r of requests)
		(per[r.path] ??= []).push(JSON.parse(JSON.stringify(r.params.query ?? r.params.path ?? {})));
	return Object.fromEntries(Object.entries(per).sort(([a], [b]) => a.localeCompare(b)));
}

async function open(category: IndexCategory, query = '', routes = ROUTES) {
	visit(`/explore?mode=index&kind=${category}${query ? `&${query}` : ''}`);
	const api = fakeApi(routes);
	render(IndexView, { category });
	await settled();
	return api;
}

/** One address of a list: its requests and what it shows. */
const SCENARIOS: [IndexCategory, string][] = [
	['instruments', ''],
	['instruments', 'q=huur&sort=article_count&legal_area=bouwen-en-wonen&policy_domain=x'],
	['instruments', 'soort=verdrag&jurisdiction=eu&leeg=1&van=2020-01-01&tot=2024-12-31'],
	['judgments', ''],
	[
		'judgments',
		'q=huur&tier=rechtbank&court_kind=rechtbank&subject_area=Civiel+recht&procedure=Hoger+beroep&van=2020-01-01&tot=2020-12-31&sort=date_asc'
	],
	['judgments', 'source=echr&subject=Huurrecht&sort=citation_count'],
	['dossiers', ''],
	['dossiers', 'q=36600'],
	[
		'dossiers',
		'stand=closed&uitkomst=aangenomen&phase=Eerste+Kamer,Tweede+Kamer&has_phase=Raad+van+State&track=Wetsvoorstel&ministerie=bzk&van=2020-01-01&sort=number'
	],
	['dossiers', 'stand=all&sort=last_activity'],
	['committees', ''],
	['committees', 'only_active=1&q=wonen&sort=name&dir=desc'],
	['committees', 'kamer=EK'],
	['members', ''],
	['members', 'include_inactive=1&fractie=VVD&q=kops&sort=party'],
	['members', 'kamer=EK&van=2020-01-01'],
	['factions', ''],
	['factions', 'include_inactive=1&q=pvv&sort=abbreviation&dir=desc'],
	['factions', 'kamer=EK'],
	['decisions', ''],
	['decisions', 'soort=Motie&passed=false&dossier=36600&fractie=VVD&q=huur&van=2026-01-01'],
	['decisions', 'kamer=EK&sort=subject'],
	['cabinets', ''],
	['cabinets', 'coalitie=VVD&van=2010-01-01&q=rutte&sort=name'],
	['ministers', ''],
	['ministers', 'kabinet=jetten&post=minister&q=a&van=2026-01-01'],
	['ministers', 'weergave=naast'],
	['commitments', ''],
	[
		'commitments',
		'status=Openstaand&overdue=1&kabinet=jetten&ministerie=bzk&persoon=x&q=brief&van=2026-01-01&sort=expected_resolution'
	],
	['documents', ''],
	['documents', 'kamer=EK&soort=Motie&q=36600&van=2026-01-01&tot=2026-06-30']
];

describe('the stand of a source', () => {
	it('says under the count of the EHRM that its source is paused, and how far it goes', async () => {
		await open('judgments', 'source=echr');
		await waitFor(() =>
			expect(text(document.querySelector('.result-head .dekking'))).toBe(
				'HUDOC wordt niet meer bijgewerkt, stand 8 oktober 2026'
			)
		);
	});

	it('is not asked for a list of every court', async () => {
		const api = await open('judgments');
		expect(api.requests.some((r) => r.path === '/api/stats')).toBe(false);
	});
});

describe('Bronnen, list by list', () => {
	it.each(SCENARIOS)('%s ?%s', async (category, query) => {
		const api = await open(category, query);
		expect(asked(api.requests)).toMatchSnapshot('requests');
		expect(await view()).toMatchSnapshot('view');
	});
});

describe('Bronnen, the first page', () => {
	it('is asked once, whatever the rows that come', async () => {
		const api = await open('documents');
		const rows = api.asked('/api/documents').filter((p) => p.query?.facets === false);
		expect(rows).toHaveLength(1);
	});
});

describe('Bronnen, an empty list', () => {
	const none: Partial<Record<ApiPath, FakeAnswer>> = {
		...ROUTES,
		'/api/instruments': list(empty),
		'/api/judgments': list(empty),
		'/api/dossiers': list(empty),
		'/api/committees': [],
		'/api/members': [],
		'/api/factions': [],
		'/api/decisions': list({ ...empty, partial: false } as Faceted),
		'/api/commitments': list(empty),
		'/api/documents': list(empty)
	};
	it.each([
		['instruments', ''],
		['instruments', 'q=huur'],
		['judgments', 'tier=hoge_raad'],
		['dossiers', ''],
		['dossiers', 'stand=closed'],
		['dossiers', 'stand=all&q=x'],
		['committees', ''],
		['members', ''],
		['factions', 'q=x'],
		['decisions', ''],
		['cabinets', 'q=zzz'],
		['ministers', 'q=zzz'],
		['commitments', ''],
		['documents', 'soort=Motie']
	] as [IndexCategory, string][])('%s ?%s', async (category, query) => {
		await open(category, query, none);
		expect(text(document.querySelector('.results'))).toMatchSnapshot();
	});
});

describe('Bronnen, the address', () => {
	it('drops the filters and the open row in a tab, the Kamer kept', async () => {
		await open('dossiers', 'kamer=EK&phase=Eerste+Kamer&q=x&sort=title&open=dossiers/1&leeg=1');
		const tabs = [...document.querySelectorAll('.catbar a')].map((a) => a.getAttribute('href'));
		expect(tabs).toMatchSnapshot();
	});

	it('takes a filter on and off in one step, the open row and the sort kept', async () => {
		const api = await open('dossiers', 'sort=title&open=dossiers/1');
		await fireEvent.click(screen.getByRole('button', { name: /^Begroting/ }));
		await settled();
		expect(page.url.search).toMatchSnapshot();
		expect(api.asked('/api/dossiers').at(-1)).toMatchObject({ query: { kind: 'Begroting' } });
		await fireEvent.click(screen.getByText('Wissen'));
		expect(page.url.search).toMatchSnapshot();
	});

	it('says tellen… while a filter loads, and no count beside a list that failed (B24)', async () => {
		let answer: (value: unknown) => void = () => {};
		let failing = false;
		await open('dossiers', '', {
			...ROUTES,
			'/api/dossiers': (r) =>
				failing
					? fail(500)
					: r.params.query?.kind
						? new Promise((resolve) => (answer = resolve))
						: list(live.dossiers)(r)
		});
		const count = () => document.querySelector('.result-count')?.textContent?.trim();
		const before = count();
		expect(before).toMatch(/\d/);
		await fireEvent.click(screen.getByRole('button', { name: /^Begroting/ }));
		await waitFor(() => expect(count()).toBe('tellen…'));
		failing = true;
		answer(fail(500));
		await settled();
		expect(screen.getByRole('alert').textContent).toContain('konden niet worden geladen');
		expect(count()).not.toBe(before);
		expect(document.querySelector('.result-count')?.textContent ?? '').not.toMatch(/\d/);
	});

	it('asks the next page from the rows it has', async () => {
		const api = await open('instruments');
		await fireEvent.click(screen.getByText(/^Volgende wetten/));
		await settled();
		expect(api.asked('/api/instruments').at(-1)).toMatchObject({
			query: { offset: 3, facets: false }
		});
	});

	it('offers no next page once all sitting members are in', async () => {
		const [m] = live.members;
		const seated = Array.from({ length: 150 }, (_, i) => ({
			...m,
			id: `members/${i}`,
			key: `${i}`
		}));
		await open('members', '', { ...ROUTES, '/api/members': seated });
		expect(document.querySelectorAll('.results a.row-title')).toHaveLength(150);
		expect(screen.queryByText(/^Volgende kamerleden/)).toBeNull();
	});

	it('puts the text searched for in the address once the typing pauses', async () => {
		await open('members');
		const field = screen.getByRole('searchbox', { name: 'Zoek in kamerleden' });
		await fireEvent.input(field, { target: { value: 'kop' } });
		expect(page.url.searchParams.get('q')).toBeNull();
		await waitFor(() => expect(page.url.searchParams.get('q')).toBe('kop'));
	});

	it('switches the Kamer as a choice, dropping the fractie and the open row', async () => {
		await open('members', 'fractie=VVD&open=members/x&q=a');
		const kamer = screen.getByRole('group', { name: 'Kamer' });
		await fireEvent.click(within(kamer).getByRole('button', { name: /Eerste/ }));
		expect(page.url.search).toMatchSnapshot();
	});

	it('turns the direction of a sort done here', async () => {
		await open('factions', 'include_inactive=1');
		await fireEvent.click(screen.getByRole('button', { name: /^Aflopend/ }));
		expect(page.url.searchParams.get('dir')).toBe('asc');
	});

	it('opens a Kamerstuk in place, and closes it with Esc', async () => {
		await open('documents');
		const toggle = document.querySelector<HTMLElement>('.results .row-toggle')!;
		await fireEvent.click(toggle);
		expect(page.url.searchParams.get('open')).toMatch(/^documents\//);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(page.url.searchParams.get('open')).toBeNull();
	});
});

describe('Bronnen, the way back', () => {
	// Two dossiers under one number: one row that opens to them.
	const [d] = live.dossiers.items;
	const group: Faceted = {
		items: [
			{ ...d, id: 'dossiers/37020', key: '37020', number: '37020', same_number_count: 1 },
			{
				...d,
				id: 'dossiers/37020-II',
				key: '37020-II',
				number: '37020-II',
				suffix: 'II',
				same_number_count: 1
			}
		],
		total: 2,
		facets: {}
	};

	it('keeps a dossier group open across another list', async () => {
		visit('/explore?mode=index&kind=dossiers');
		fakeApi({ ...ROUTES, '/api/dossiers': list(group) });
		const { rerender } = render(IndexView, { category: 'dossiers' });
		await settled();
		const toggle = () => document.querySelector<HTMLElement>('.results .row-toggle')!;
		await fireEvent.click(toggle());
		expect(toggle().getAttribute('aria-expanded')).toBe('true');
		for (const category of ['decisions', 'dossiers'] as const) {
			visit(`/explore?mode=index&kind=${category}`);
			await rerender({ category });
			await settled();
		}
		expect(toggle().getAttribute('aria-expanded')).toBe('true');
	});
});
