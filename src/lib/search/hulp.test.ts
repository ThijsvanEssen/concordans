import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { BROWSE, unreadLine } from './hulp';

type Searched = Schema<'SearchedDTO'>;
const read = (fields: Searched['fields'], text: 'done' | 'none'): Searched =>
	({ fields, completeness: { text: { state: text } }, signed_for: [] }) as unknown as Searched;

describe('the help of a search that found nothing', () => {
	it('says what was not read, for the kinds whose text is not', () => {
		expect(
			unreadLine({
				articles: read(['title', 'number', 'text'], 'done'),
				documents: read(['title', 'number'], 'none'),
				judgments: read(['title', 'name', 'number', 'summary'], 'none')
			})
		).toBe(
			'Gezocht in titels, nummers, namen en inhoudsindicaties, niet in de tekst van kamerstukken en uitspraken'
		);
	});

	it('says nothing where every kind is read in its text', () => {
		expect(unreadLine({ articles: read(['title', 'text'], 'done') })).toBeNull();
		expect(unreadLine({})).toBeNull();
	});

	it('offers the five rubrieken to browse in', () => {
		expect(BROWSE.map((b) => b.label)).toEqual([
			'Wetten',
			'Rechtspraak',
			'Kamerstukken',
			'Parlement',
			'Regering'
		]);
	});

	// One help for the page and the dialog: an empty search reads the same in both.
	it('is drawn by the page of results and by the dialog alike', () => {
		for (const file of ['src/routes/(main)/zoeken/+page.svelte', 'src/lib/search/Search.svelte']) {
			expect(readFileSync(file, 'utf8')).toContain('<ZoekHulp');
		}
	});
});
