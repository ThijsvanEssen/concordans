// A table in a judgment or a Kamerstuk is laid out as one, as in an article (TextTable): the
// sentence before it a paragraph, a citation in a cell a link, a note's marker where it stands.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import rbzwb from '$lib/fixtures/judgment-rbzwb-2019-1062-tables.json';
import paper33478 from '$lib/fixtures/paper-kst-33478-3-tables.json';
import { bodyItems } from '$lib/components/explore/readers/judgment-text';
import { paperBlocks, paperParagraphs, type PaperSource } from '$lib/text/anchor';
import type { Schema } from '$lib/api/types';
import type { Span } from '$lib/text/segments';
import TextBlocks from './TextBlocks.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const items = bodyItems(rbzwb.paragraphs as Schema<'JudgmentParagraph'>[]);
const rov = items.find((i) => i.kind === 'rov' && i.num === '2.5') as Extract<
	(typeof items)[number],
	{ kind: 'rov' }
>;

const cite = (text: string, word: string): Span =>
	({
		start: text.indexOf(word),
		end: text.indexOf(word) + word.length,
		text: null,
		kind: 'article',
		aanhef: false,
		target: {
			id: 'articles/bwbr0004770_36',
			key: 'bwbr0004770_36',
			collection: 'articles',
			bwb_id: 'BWBR0004770',
			article_number: '36',
			display_name: null
		}
	}) as Span;

describe('a table in the text of a judgment', () => {
	it('stands as a table under the sentence that announces it', () => {
		const { container } = render(TextBlocks, { text: rov.body, tables: rov.tables ?? [] });
		expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
			'Het onder 1.1 vermelde onbetaalde totaalbedrag van € 422.165 bestaat uit:'
		]);
		const rows = container.querySelectorAll('table tr');
		expect(rows).toHaveLength(10);
		expect(rows[0].querySelectorAll('td')[1].getAttribute('rowspan')).toBe('2');
		expect(rows[9].querySelector('td')!.textContent).toBe('Totaal');
	});

	it('links a citation in a cell, and sets a marker where it stands', () => {
		const { container } = render(TextBlocks, {
			text: rov.body,
			tables: rov.tables ?? [],
			citations: [cite(rov.body, 'Loonheffingen')],
			notes: [{ id: 'fn-1', label: '1', at: rov.body.indexOf(' bestaat') }]
		});
		const cell = container.querySelectorAll('table tr')[0].querySelectorAll('td')[2];
		expect(cell.querySelector('a')?.textContent).toBe('Loonheffingen');
		expect(container.querySelector('p')!.textContent).toContain('1');
	});

	it('reads as before without a table: one paragraph', () => {
		const { container } = render(TextBlocks, { text: 'Een zin.', tables: [] });
		expect(container.querySelectorAll('p')).toHaveLength(1);
		expect(container.querySelector('table')).toBeNull();
	});
});

describe('a table in a Kamerstuk', () => {
	it('is its alinea: one block, the table laid out', () => {
		const doc = paper33478 as unknown as PaperSource;
		const b = paperBlocks(paperParagraphs(doc), doc).find((x) => x.tables.length)!;
		const { container } = render(TextBlocks, { text: b.text, tables: b.tables });
		const rows = container.querySelectorAll('table tr');
		expect(rows.length).toBeGreaterThan(20);
		expect(rows[0].querySelector('td')!.textContent).toBe('I. 1');
		expect(rows[0].querySelector('td')!.getAttribute('rowspan')).toBe('2');
	});
});
