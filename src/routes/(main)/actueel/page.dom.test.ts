// Actueel asks the days counted (/api/feed/summary) once the feed has answered the filters
// shown, once per change of the filters; a next page asks only the days it added.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import { appNavigation, back, open } from '$lib/test/navigation.svelte';
import { addDays, vandaag } from '$lib/text/datum';
import Page from './+page.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);
// The route's heading reads SvelteKit's route id, which a test has none of.
vi.mock('$lib/seo/RouteKop.svelte', () => ({ default: () => {} }));

const today = vandaag();
const day = (n: number) => addDays(today, -n);
const item = (key: string, date: string) => ({
	id: `documents/${key}`,
	node: { collection: 'documents', key },
	kind: 'Brief regering',
	date,
	title: key,
	persons: []
});

/** The feed in two pages: today and yesterday, then three days back. */
function feed(r: FakeRequest) {
	const next = r.params.query?.cursor === '1';
	return {
		items: next ? [item('c', day(2)), item('d', day(3))] : [item('a', today), item('b', day(1))],
		next_cursor: next ? null : '1',
		data_as_of: { tk: { newest: `${today}T08:00:00` } }
	};
}

let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	api = fakeApi({
		'/api/feed': (r) => (r.params.query?.facets ? { items: [], total: 4, facets: {} } : feed(r)),
		'/api/feed/summary': (r) => ({
			days: Array.from({ length: Number(r.params.query?.days) }, (_, i) => ({
				date: addDays(String(r.params.query?.until), -i),
				counts: []
			}))
		}),
		'/api/documents': { items: [] },
		'/api/cabinets': [],
		'/api/factions': []
	});
});
afterEach(() => vi.restoreAllMocks());

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

// The days counted, not the chamber's schedule (NextSitting), which names no day.
const summaries = () =>
	api
		.asked('/api/feed/summary')
		.filter(({ query }) => query?.until)
		.map(({ query }) => ({ until: query?.until, days: query?.days, soort: query?.kind }));

describe('the days counted on Actueel', () => {
	it('asks one summary per change of the filters, after the feed answered', async () => {
		open('/actueel');
		render(Page);
		await settle();
		// The last day of a page waits for the next one (wholeDays): one day counted.
		expect(summaries()).toEqual([{ until: today, days: 1, soort: undefined }]);
		await appNavigation.goto('/actueel?soort=Brief+regering');
		await settle();
		expect(summaries()).toHaveLength(2);
		expect(summaries()[1]).toEqual({ until: today, days: 1, soort: 'Brief regering' });
	});

	it('asks only the days a next page added', async () => {
		open('/actueel');
		const { getByText } = render(Page);
		await settle();
		await fireEvent.click(getByText('Volgende dagen'));
		await settle();
		// The day held back, with the days the page added.
		expect(summaries()).toEqual([
			{ until: today, days: 1, soort: undefined },
			{ until: day(1), days: 3, soort: undefined }
		]);
	});
});

describe('Back to Actueel', () => {
	it('finds the days as they stood, Volgende dagen included, without asking them again', async () => {
		open('/actueel?soort=Motie');
		const first = render(Page);
		await settle();
		await fireEvent.click(first.getByText('Volgende dagen'));
		await settle();
		expect(first.getByText('d')).toBeTruthy();
		const asked = api.asked('/api/feed').filter(({ query }) => !query?.facets).length;
		cleanup();
		await appNavigation.goto('/dossiers/36000');
		back();
		const again = render(Page);
		await settle();
		expect(again.getByText('d')).toBeTruthy();
		expect(api.asked('/api/feed').filter(({ query }) => !query?.facets)).toHaveLength(asked);
	});
});

describe('the votes of a fractie on Actueel (B5)', () => {
	const vote = {
		id: 'decisions/s1',
		node: { collection: 'decisions', key: 's1' },
		kind: 'stemming',
		date: today,
		title: 'Motie over de huur',
		persons: [],
		vote: {
			chamber: 'TK',
			passed: true,
			outcome: 'aangenomen',
			tally: { Voor: 80, Tegen: 70 },
			coalition_factions: [],
			party_choice: 'Tegen'
		}
	};

	beforeEach(() => {
		api = fakeApi({
			'/api/feed': (r) =>
				r.params.query?.facets
					? { items: [], total: 1, facets: { faction: [{ value: 'vvd', count: 3 }] } }
					: { items: [vote], next_cursor: null, data_as_of: {} },
			'/api/feed/summary': { days: [] },
			'/api/documents': { items: [] },
			'/api/cabinets': [],
			'/api/factions': [
				{ key: 'vvd', abbreviation: 'VVD' },
				{ key: 'd66', abbreviation: 'D66' }
			]
		});
	});

	it('asks them as `party` with `vote`, and says what the fractie chose on each', async () => {
		open('/actueel?stemde=d66&stem=tegen');
		const { findByText } = render(Page);
		await findByText('D66 stemde tegen');
		const asked = api.asked('/api/feed').map((p) => p.query);
		expect(asked.every((q) => q?.party === 'd66' && q?.vote === 'tegen')).toBe(true);
	});

	it('keeps who submitted apart from who voted, each under its own name', async () => {
		open('/actueel');
		const { findAllByText, getAllByText, getByRole } = render(Page);
		await findAllByText('Ingediend door');
		// Stemde stands under Meer in the bar of filters.
		await fireEvent.click(getByRole('button', { name: /^Meer/ }));
		expect(getAllByText('Stemde').length).toBeGreaterThan(0);
		// The fractie submitted-by is still `faction`.
		open('/actueel?fractie=vvd');
		await appNavigation.goto('/actueel?fractie=vvd');
		await settle();
		expect(api.asked('/api/feed').some((p) => p.query?.faction === 'vvd' && !p.query?.party)).toBe(
			true
		);
	});
});
