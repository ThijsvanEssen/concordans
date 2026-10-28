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
			'Tekst zoals vastgesteld, latere wijzigingen niet verwerkt, EUR-Lex'
		);
		await fireEvent.click(screen.getByRole('button', { name: /^Citeer/ }));
		const bron = screen.getByRole('menuitem', { name: /eur-lex\.europa\.eu/ });
		expect(bron.getAttribute('href')).toBe(EURLEX);
	});
});

describe('ArticleReader, whether the article holds (besluit 30)', () => {
	const bw = (validity: unknown, repealed = false) => {
		const art = {
			...detail.article,
			bwb_id: 'BWBR0001',
			article_number: '1',
			address: '1',
			repealed,
			...(validity === 'absent' ? {} : { validity })
		};
		fakeApi({
			'/api/articles/{bwb_id}/{article_number}': {
				...detail,
				article: art,
				instrument: { ...instrument, bwb_id: 'BWBR0001', celex: null }
			},
			'/api/articles/{bwb_id}/{article_number}/history': { versions: [] },
			'/api/instruments/{identifier}': { ...instrument, bwb_id: 'BWBR0001', celex: null }
		});
	};
	const bwNode = {
		...node,
		raw: { props: { bwb_id: 'BWBR0001', article_number: '1' } }
	} as unknown as GraphNode;
	const expired = {
		state: 'expired',
		date: '2020-01-01',
		as_of: '2026-10-21',
		successors: [
			{
				id: 'instruments/bwbr0002',
				key: 'bwbr0002',
				bwb_id: 'BWBR0002',
				celex: null,
				official_id: null,
				title: 'Nieuwe wet',
				citation_title: 'Nieuwe wet',
				articles: 3,
				path: '/wetten/BWBR0002'
			}
		]
	};

	it('says vervallen, once, with the successor, and never Geldend recht', async () => {
		bw(expired);
		const { container } = render(ArticleReader, { node: bwNode });
		await settle();
		const stand = container.querySelector('.validity')!;
		expect(stand.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Vervallen per 1 januari 2020, opvolger: Nieuwe wet'
		);
		expect(stand.querySelector('.validity__no')?.textContent).toBe(
			'Vervallen per 1\u00a0januari\u00a02020'
		);
		expect(container.textContent).not.toContain('Geldend recht');
		expect(container.querySelectorAll('.head__stand')).toHaveLength(0);
	});

	it('dates the citation on today in Amsterdam, as the page does, not on the day the data stands on (T5)', async () => {
		// Half past midnight in the Netherlands on the 22nd: the 21st in UTC, and as_of's day.
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-21T22:30:00Z'));
		try {
			bw({ ...expired, state: 'in_force', date: null });
			render(ArticleReader, { node: bwNode });
			await settle();
			await fireEvent.click(screen.getByRole('button', { name: /^Citeer/ }));
			expect(document.body.textContent).toContain('tekst geldend op 22\u00a0oktober\u00a02026');
			expect(document.body.textContent).not.toContain('tekst geldend op 21\u00a0oktober\u00a02026');
		} finally {
			vi.useRealTimers();
		}
	});

	it('says nog niet in werking with its day', async () => {
		bw({ state: 'not_in_force_yet', date: '2027-01-01', as_of: '2026-10-21', successors: [] });
		const { container } = render(ArticleReader, { node: bwNode });
		await settle();
		expect(container.querySelector('.validity')?.textContent).toBe(
			'Nog niet in werking (per 1\u00a0januari\u00a02027)'
		);
		expect(container.querySelector('.validity__no')).toBeNull();
	});

	it('labels nothing Geldend where the API does not know', async () => {
		bw(null);
		const { container } = render(ArticleReader, { node: bwNode });
		await settle();
		expect(container.textContent).not.toContain('Geldend recht');
	});

	it('changes nothing on an API without validity', async () => {
		bw('absent');
		const { container } = render(ArticleReader, { node: bwNode });
		await settle();
		expect(container.querySelector('.validity')).toBeNull();
		// The stand no sentence: the day of its text is a fact of the strip, as a law's (A190).
		expect(container.querySelector('.head__stand')).toBeNull();
	});
});
