// The contents beside a law, a stuk and a uitspraak keep to the principles of a digital
// table of contents (GOV.UK contents list, NN/g, W3C on landmarks): one nav called Inhoud,
// every level reachable, one tab stop for every item, and no counts or meta in the list.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import fixture from '$lib/test/judgment.json';
import DocumentToc from './DocumentToc.svelte';
import JudgmentToc from './JudgmentToc.svelte';
import LezenNav from './LezenNav.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const settle = async () => {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
};

/** What a keyboard stops at inside `item`: a link, a button or a summary not taken out of the order. */
const stops = (item: Element) =>
	[...item.querySelectorAll('a[href], button, summary')].filter(
		(el) => el.getAttribute('tabindex') !== '-1'
	);

const node = (collection: string, key: string, raw: object = {}): GraphNode =>
	({
		id: `${collection}/${key}`,
		collection,
		key,
		label: key,
		drawClass: collection,
		raw
	}) as GraphNode;

beforeEach(() => open('/'));
afterEach(() => vi.restoreAllMocks());

describe('the contents of a stuk', () => {
	it('is one nav, every level a row, one tab stop a row, and no kind or count', async () => {
		fakeApi({
			'/api/documents/{key}': {
				title: 'Memorie van toelichting',
				kind: 'memorie_van_toelichting',
				sections: [1, 2, 3, 4, 2, 1].map((level, i) => ({
					id: `s${i}`,
					level,
					heading: `Kop ${i}`
				}))
			}
		});
		const { container } = render(DocumentToc, { selection: node('documents', 'kst-eenvoud-1') });
		await settle();
		const navs = container.querySelectorAll('nav');
		expect(navs).toHaveLength(1);
		expect(navs[0].getAttribute('aria-label')).toBe('Inhoud');
		const rows = [...container.querySelectorAll('li')];
		expect(rows).toHaveLength(6);
		for (const li of rows) expect(stops(li)).toHaveLength(1);
		expect(container.textContent).not.toMatch(/Memorie van toelichting|artikelen|\d+ /);
	});
});

describe('the contents of a uitspraak', () => {
	it('is one nav with one tab stop for every row and every overweging', async () => {
		const { judgment } = fixture.detail;
		open(`/uitspraken/${judgment.ecli}`);
		fakeApi({ '/api/judgments/{ecli}': fixture.detail });
		const { container } = render(JudgmentToc, {
			selection: node('judgments', judgment.key, judgment)
		});
		await settle();
		expect(container.querySelectorAll('nav')).toHaveLength(1);
		const items = [...container.querySelectorAll('li')];
		expect(items.length).toBeGreaterThan(0);
		for (const li of items) expect(stops(li)).toHaveLength(1);
	});
});

describe('the contents of a law', () => {
	const crumb = (type: string, label: string, anchor: string) => ({
		type,
		label,
		title: null,
		anchor
	});
	const art = (n: number, ...bc: ReturnType<typeof crumb>[]) => ({
		key: `articles/eenvoud/${n}`,
		article_number: String(n),
		label: `Artikel ${n}`,
		stub: false,
		breadcrumb: bc
	});

	it('keeps every division a row of its own, one tab stop for each', async () => {
		const boek = crumb('boek', 'Boek 1', 'deel-boek-1');
		const titel = crumb('titel', 'Titel 1', 'deel-boek-1-titel-1');
		const afdeling = crumb('afdeling', 'Afdeling 1', 'deel-boek-1-titel-1-afdeling-1');
		fakeApi({
			'/api/instruments/{bwb_id}/articles': {
				items: [art(1, boek, titel, afdeling), art(2, boek, titel), art(3, boek)],
				annexes: []
			}
		});
		const { container } = render(LezenNav, {
			selection: node('articles', 'articles/eenvoud/1', { props: { bwb_id: 'BWBREENVOUD' } })
		});
		await settle();
		const navs = container.querySelectorAll('nav');
		expect(navs).toHaveLength(1);
		expect(navs[0].getAttribute('aria-label')).toBe('Inhoud');
		expect(container.textContent).toContain('Afdeling 1');
		for (const head of container.querySelectorAll('summary')) {
			expect(stops(head.parentElement!.firstElementChild!)).toHaveLength(1);
		}
		for (const li of container.querySelectorAll('li')) expect(stops(li)).toHaveLength(1);
	});

	it('says whether it is open, and opens with Space and the arrows on its link', async () => {
		const boek = crumb('boek', 'Boek 1', 'deel-boek-1');
		fakeApi({
			'/api/instruments/{bwb_id}/articles': { items: [art(1, boek), art(2, boek)], annexes: [] }
		});
		const { container } = render(LezenNav, {
			selection: node('articles', 'articles/eenvoud/1', { props: { bwb_id: 'BWBREENVOUD' } })
		});
		await settle();
		const link = container.querySelector('a.group__label') as HTMLElement;
		const details = link.closest('details')!;
		expect(link.getAttribute('aria-expanded')).toBe(String(details.open));
		await fireEvent.keyDown(link, { key: 'ArrowLeft' });
		expect(details.open).toBe(false);
		await fireEvent.keyDown(link, { key: 'ArrowRight' });
		expect(details.open).toBe(true);
		await fireEvent.keyDown(link, { key: ' ' });
		expect(details.open).toBe(false);
	});
});
