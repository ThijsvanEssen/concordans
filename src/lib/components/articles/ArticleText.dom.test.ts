// A table in the text of an article is laid out as one (TextTable): art. 2 Regeling
// aanwijzing aanbieders essentiële diensten EZK, whose providers stood as loose paragraphs,
// a sector no longer beside its providers.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import fixture from '$lib/fixtures/article-bwbr0045077_2.json';
import type { Begrip, Definitie } from '$lib/text/begrippen';
import type { Table } from '$lib/text/tables';
import ArticleText from './ArticleText.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const { article } = fixture;
const props = {
	text: article.text,
	parts: article.parts,
	tables: article.tables as Table[],
	begrippen: fixture.term_spans as Begrip[],
	definities: fixture.definitions as unknown as Definitie[]
};

describe('a table in the text of an article', () => {
	it('stands as a table under the sentence that announces it', () => {
		const { container } = render(ArticleText, props);
		const table = container.querySelector('table')!;
		expect(table).not.toBeNull();
		const p = [...container.querySelectorAll('p')].map((e) => e.textContent?.trim());
		expect(p).toEqual([
			'Als aanbieders van een essentiële dienst of categorieën van zodanige aanbieders worden aangewezen:'
		]);
		expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
			'Sector',
			'Aanbieder',
			'Essentiële dienst'
		]);
		const rows = table.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(9);
		const sector = rows[0].querySelector('td')!;
		expect([sector.textContent, sector.getAttribute('rowspan')]).toEqual([
			'Digitale infrastructuur',
			'3'
		]);
	});

	it('marks a defined term in a cell, none in the header', () => {
		const { container } = render(ArticleText, props);
		expect(container.querySelectorAll('thead .begrip')).toHaveLength(0);
		const cell = container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
		expect([...cell.querySelectorAll('.begrip')].map((a) => a.textContent)).toEqual(['aanbieder']);
	});
});
