// The heading of an article in the whole law: its number and its opschrift, read as two words
// by a screen reader too ("Artikel 1.2 Uitbreiding …", not "Artikel 1.2Uitbreiding …", B6).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import WholeLawReaderArticle from './WholeLawReaderArticle.svelte';
import type { Row } from '$lib/text/law-article-text';

const row = (r: Partial<Row>): Row => ({
	id: 'articles/bwbr0011353_1_2',
	key: 'bwbr0011353_1_2',
	article_number: '1.2',
	label: 'Artikel 1.2',
	heading: 'Uitbreiding en beperking partnerregeling',
	address: '1.2',
	breadcrumb: [],
	text: null,
	parts: null,
	tables: [],
	footnoteMarks: [],
	text_preview: 'Tekst.',
	...r
});

const props = (r: Row) => ({
	row: r,
	bwbId: 'BWBR0011353',
	peildatum: '2020-01-01',
	detail: undefined,
	citationOf: () => null,
	onNear: () => {}
});

describe('the heading of an article in the whole law', () => {
	it('names its number and opschrift apart', () => {
		render(WholeLawReaderArticle, props(row({})));
		const link = screen.getByRole('link');
		expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Artikel 1.2 Uitbreiding en beperking partnerregeling'
		);
	});

	it('does so for an article no longer in the law', () => {
		const { container } = render(WholeLawReaderArticle, props(row({ key: null })));
		const head = container.querySelector('.whole-article-head')!;
		expect(head.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
			/^Artikel 1\.2 Uitbreiding en beperking partnerregeling /
		);
	});

	it('names an article without a number once (B9, Algemene bepaling of the Grondwet)', () => {
		const { container } = render(
			WholeLawReaderArticle,
			props(row({ article_number: null, label: 'Algemene bepaling', heading: 'Algemene bepaling' }))
		);
		const head = container.querySelector('.whole-article-head')!;
		expect(head.textContent?.replace(/\s+/g, ' ').trim()).toBe('Algemene bepaling');
	});
});
