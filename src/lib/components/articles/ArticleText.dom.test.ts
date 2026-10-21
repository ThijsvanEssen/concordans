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

describe('the footnotes of an article (#875)', () => {
	// Successiewet art. 24 lid 1: the marker in the head of the table, the note under it.
	const text =
		'1. De belasting wordt geheven naar het volgende tarief.\n' +
		'Gedeelte\ten\tI. indien verkregen in de rechte lijn\tII. in overige gevallen\n' +
		'€ 0\t€ 158.669\t10%\t30%\n' +
		'1 Voor afstammelingen in de tweede of verdere graad, vermeerderd met 80% daarvan.\n' +
		'2. De overdrachtsbelasting strekt in mindering.';
	const tables: Table[] = [
		{
			start: text.indexOf('Gedeelte'),
			end: text.indexOf('\n1 Voor'),
			head_rows: 1,
			columns: 4,
			spans: []
		}
	];
	const footnoteMarks = [{ at: text.indexOf('lijn') + 4, number: '1' }];

	it('raises the marker, a link to its note, and the note links back', () => {
		const { container } = render(ArticleText, { text, tables, footnoteMarks });
		const marker = container.querySelector<HTMLAnchorElement>('thead sup a')!;
		expect([marker.textContent, marker.getAttribute('href')]).toEqual(['1', '#fn-1']);
		expect(marker.closest('sup')!.id).toBe('fnref-1');
		expect(marker.closest('th')!.textContent).toBe('I. indien verkregen in de rechte lijn1');
		const note = container.querySelector<HTMLElement>('#fn-1')!;
		expect(note.textContent?.trim()).toMatch(/^1 Voor afstammelingen/);
		expect(note.querySelector('a')!.getAttribute('href')).toBe('#fnref-1');
	});

	it('lands on the note at a click on its marker, and back', () => {
		// jsdom has neither CSS.escape nor scrolling.
		vi.stubGlobal('CSS', { escape: (s: string) => s });
		Element.prototype.scrollIntoView = vi.fn();
		const { container } = render(ArticleText, { text, tables, footnoteMarks });
		container.querySelector<HTMLAnchorElement>('thead sup a')!.click();
		expect(container.querySelector('#fn-1')!.classList).toContain('is-landed');
		container.querySelector<HTMLAnchorElement>('#fn-1 a')!.click();
		expect(container.querySelector('#fnref-1')!.classList).toContain('is-landed');
		vi.unstubAllGlobals();
	});

	it('stays as it was without footnote_marks', () => {
		const { container } = render(ArticleText, { text, tables });
		expect(container.querySelector('sup')).toBeNull();
		expect(container.querySelector('#fn-1')).toBeNull();
	});
});

describe('the footnotes of their own of an article (#881)', () => {
	// BWBV0007162 art. 15: the note's marker after "de Raad", the note no text but its own,
	// with a link to the regulation it names; a note of the heading has no marker.
	const text = '1. Verordening (EU) 2016/1953 van het Europees Parlement en de Raad, of een ander.';
	const at = text.indexOf(', of');
	const footnoteMarks = [{ at, number: '1', footnote: 1 }];
	const footnotes = [
		{ number: '4', text: 'Ter verduidelijking: geen van de bepalingen.' },
		{ number: '1', text: 'Verordening (EU) 2016/1953 van het Europees Parlement (PB EU L 311).' }
	];
	const reference = (start: number, end: number, exists: boolean, footnote: number | null) => ({
		leden: [],
		onderdelen: [],
		aanhef: false,
		kind: 'extref',
		bwb_id: null,
		article: null,
		celex: '32016R1953',
		doc: '32016R1953',
		text: 'Verordening (EU) 2016/1953',
		start,
		end,
		footnote,
		target: {
			collection: 'instruments' as const,
			key: '32016r1953',
			exists,
			id: 'instruments/32016r1953'
		}
	});

	it('lists the notes under the text, the marker a link to its own, the note back', () => {
		const { container } = render(ArticleText, {
			text,
			footnoteMarks,
			footnotes,
			footnoteReferences: [reference(0, 26, true, 1)]
		});
		expect(container.querySelector('.lid')!.textContent).not.toContain('PB EU L 311');
		const marker = container.querySelector<HTMLAnchorElement>('sup a')!;
		expect([marker.textContent, marker.getAttribute('href')]).toEqual(['1', '#fn-1']);
		expect(marker.closest('sup')!.id).toBe('fnref-1');
		const notes = [...container.querySelectorAll<HTMLElement>('.voetnoten .voetnoot')];
		expect(notes.map((n) => [n.id, n.textContent?.trim().slice(0, 12)])).toEqual([
			['fn-4', '4Ter verduid'],
			['fn-1', '1Verordening']
		]);
		// The note of the heading has no marker to go back to.
		expect(notes[0].querySelector('a')).toBeNull();
		expect(notes[1].querySelector('a.voetnoot__terug')!.getAttribute('href')).toBe('#fnref-1');
		expect(notes[1].querySelector('a.cited')!.textContent).toBe('Verordening (EU) 2016/1953');
	});

	it('leaves a link to what the data does not hold, and one of the text, plain', () => {
		const { container } = render(ArticleText, {
			text,
			footnoteMarks,
			footnotes,
			footnoteReferences: [reference(0, 26, false, 1)],
			references: [reference(3, 29, true, null)]
		});
		expect(container.querySelector('#fn-1 a.cited')).toBeNull();
		expect(container.querySelector('.lid a.cited')!.textContent).toBe('Verordening (EU) 2016/1953');
	});

	it('lands on the note at a click on its marker, and back', () => {
		vi.stubGlobal('CSS', { escape: (s: string) => s });
		Element.prototype.scrollIntoView = vi.fn();
		const { container } = render(ArticleText, { text, footnoteMarks, footnotes });
		container.querySelector<HTMLAnchorElement>('sup a')!.click();
		expect(container.querySelector('#fn-1')!.classList).toContain('is-landed');
		container.querySelector<HTMLAnchorElement>('#fn-1 a')!.click();
		expect(container.querySelector('#fnref-1')!.classList).toContain('is-landed');
		vi.unstubAllGlobals();
	});

	it('shows only the notes of the lid shown alone', () => {
		const two = `${text}\n2. Een tweede lid.`;
		const { container } = render(ArticleText, {
			text: two,
			footnoteMarks,
			footnotes,
			alleen: 'lid-2'
		});
		expect(container.querySelector('.voetnoten')).toBeNull();
	});
});
