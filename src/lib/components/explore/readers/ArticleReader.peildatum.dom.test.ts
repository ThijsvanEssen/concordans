// The peildatum on the article page (W14, X14): the same list as the law's, from the versions
// of the law; an act of the EU has none, and an expired law offers no "vandaag".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import ArticleReader from './ArticleReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const instrument = {
	id: 'instruments/bwbr0001',
	key: 'bwbr0001',
	bwb_id: 'BWBR0001',
	celex: null,
	title: 'Wet op de proef',
	citation_title: 'Wet op de proef',
	short_title: null,
	abbreviation: null,
	display_name: 'Wet op de proef',
	official_url: null,
	article_count: 3,
	inbound_citation_count: 0,
	judgment_count: null
};
const detail = (validity: unknown) => ({
	article: {
		id: 'articles/bwbr0001_1',
		key: 'bwbr0001_1',
		bwb_id: 'BWBR0001',
		official_id: null,
		article_number: '1',
		label: null,
		heading: 'Begrip',
		address: '1',
		repealed: false,
		display_name: 'Art. 1 Wet op de proef',
		official_url: null,
		text: 'Een tekst.',
		parts: [],
		tables: [],
		headings: [],
		path: null,
		...(validity === undefined ? {} : { validity })
	},
	instrument,
	citations: [],
	term_spans: [],
	definitions: [],
	references: [],
	delegations: [],
	metadata: {},
	upstream_dependencies: [],
	downstream_implications: [],
	scope_articles: [],
	successors: [],
	predecessors: []
});
const version = (valid_from: string, valid_until: string | null, current = false) => ({
	key: `v${valid_from}`,
	bwb_id: 'BWBR0001',
	valid_from,
	valid_until,
	current,
	state_url: null,
	official_url: null,
	article_count: 3
});
const node = {
	id: 'articles/bwbr0001_1',
	collection: 'articles',
	key: 'bwbr0001_1',
	drawClass: 'article',
	label: 'Art. 1',
	raw: { props: { bwb_id: 'BWBR0001', article_number: '1' } }
} as unknown as GraphNode;

function api(
	validity: unknown,
	versions = [version('2001-01-01', '2020-01-01'), version('2020-01-01', null, true)]
) {
	fakeApi({
		'/api/articles/{bwb_id}/{article_number}': detail(validity),
		'/api/articles/{bwb_id}/{article_number}/history': { versions: [] },
		'/api/instruments/{identifier}': instrument,
		'/api/instruments/{bwb_id}/versions': { items: versions, total: versions.length }
	});
}

beforeEach(() => {
	open('/wetten/BWBR0001/artikel/1');
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('ArticleReader, the peildatum', () => {
	it('offers the versions of the law, today first', async () => {
		api(undefined);
		render(ArticleReader, { node });
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: /^Tekst geldend op/ }));
		expect(screen.getByText(/2 versies sinds 1 januari 2001/)).toBeTruthy();
		expect(screen.getByRole('menuitemradio', { name: /vandaag$/ })).toBeTruthy();
	});

	it('has no today in the list of an expired law, and reads null validity as unknown', async () => {
		api({ state: 'expired', date: '2020-01-01', as_of: '2026-10-21', successors: [] });
		render(ArticleReader, { node });
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: /^Laatste tekst geldend sinds/ }));
		expect(screen.queryByRole('menuitemradio', { name: /vandaag$/ })).toBeNull();
	});

	it('is there where the API does not know the validity (null)', async () => {
		api(null);
		render(ArticleReader, { node });
		await settle();
		expect(screen.getByRole('button', { name: /^Tekst geldend op/ })).toBeTruthy();
	});

	it('says there is no text before the article was made', async () => {
		api(undefined);
		fakeApi({
			'/api/articles/{bwb_id}/{article_number}': detail(undefined),
			'/api/articles/{bwb_id}/{article_number}/history': {
				versions: [
					{
						key: 'a1',
						article_version_key: 'a1',
						valid_from: '2010-01-01',
						valid_until: null,
						text_changed: true,
						change_summary: 'Eerste tekst'
					}
				]
			},
			'/api/instruments/{identifier}': instrument,
			'/api/instruments/{bwb_id}/versions': {
				items: [version('2001-01-01', '2020-01-01'), version('2020-01-01', null, true)],
				total: 2
			}
		});
		open('/wetten/BWBR0001/artikel/1?peildatum=2005-01-01');
		const { container } = render(ArticleReader, { node });
		await settle();
		expect(container.textContent).toContain(
			'Tekst van dit artikel op 1\u00a0januari\u00a02005 niet in de gegevens'
		);
	});
});
