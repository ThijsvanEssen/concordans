// An article of an act of the EU (besluit 23): its status is the text as adopted, never
// geldend recht, and its Bron is the act on EUR-Lex where the article has no address of its own.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import ArticleReader from './ArticleReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const EURLEX = 'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679';
const instrument = {
	id: 'instruments/32016r0679',
	key: '32016r0679',
	bwb_id: null,
	celex: '32016R0679',
	title: 'Verordening (EU) 2016/679',
	citation_title: 'Verordening (EU) 2016/679',
	short_title: 'Algemene verordening gegevensbescherming',
	abbreviation: 'AVG',
	display_name: 'Verordening (EU) 2016/679',
	official_url: EURLEX,
	article_count: 99,
	inbound_citation_count: 0,
	judgment_count: null
};
const detail = {
	article: {
		id: 'articles/32016r0679_6',
		key: '32016r0679_6',
		bwb_id: null,
		official_id: null,
		article_number: '6',
		label: null,
		heading: 'Rechtmatigheid van de verwerking',
		address: '6',
		repealed: false,
		display_name: 'Art. 6 AVG',
		official_url: null,
		text: 'De verwerking is alleen rechtmatig indien en voor zover.',
		parts: [],
		tables: [],
		headings: [],
		path: null
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
};
const node: GraphNode = {
	id: 'articles/32016r0679_6',
	collection: 'articles',
	key: '32016r0679_6',
	drawClass: 'article',
	label: 'Art. 6 AVG',
	raw: {
		props: { bwb_id: '32016R0679', article_number: '6' }
	} as unknown as GraphNode['raw']
};

beforeEach(() => {
	open('/wetten/32016R0679/artikel/6');
	fakeApi({
		'/api/articles/{bwb_id}/{article_number}': detail,
		'/api/articles/{bwb_id}/{article_number}/history': { versions: [] },
		'/api/instruments/{identifier}': { ...instrument, jurisdiction: 'eu', date_signed: null }
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('ArticleReader, an article of the EU', () => {
	it('stands as adopted, with the act on EUR-Lex as its Bron', async () => {
		const { container } = render(ArticleReader, { node });
		await settle();
		expect(container.textContent).not.toContain('Geldend recht');
		expect(container.querySelector('.dekking')?.textContent).toBe(
			'Tekst zoals vastgesteld, latere wijzigingen niet verwerkt, EUR-Lex ↗'
		);
		await fireEvent.click(screen.getByRole('button', { name: /^Citeer/ }));
		const bron = screen.getByRole('menuitem', { name: /eur-lex\.europa\.eu/ });
		expect(bron.getAttribute('href')).toBe(EURLEX);
	});
});
