import { describe, expect, it } from 'vitest';
import { aboutArticles, articleLabel, documentRows, judgmentRows, squash } from './concept-rows';
import fixture from '$lib/fixtures/concept.json';
import type { Schema } from '$lib/api/types';

const CONCEPT = fixture as unknown as Schema<'ConceptResponse'>;

describe('the rows of a concept', () => {
	it('names the articles a bron is about, in the order of the list', () => {
		expect(aboutArticles(CONCEPT, ['articles/bwbr0001840_120', 'articles/bwbr0001840_93'])).toBe(
			'Art. 93 Gw en Art. 120 Gw'
		);
		expect(aboutArticles(CONCEPT, [])).toBeNull();
	});

	it('makes a judgment a row as Verbonden has it: its citation, how it ended, the articles', () => {
		const [row] = judgmentRows(CONCEPT);
		expect(row.title).toBe('Rb. Den Haag');
		expect(row.uitkomst?.text).toBe('Ongegrond');
		expect(row.context).toBe('Art. 93 Gw en Art. 120 Gw');
		expect(row.identifier).toBeNull();
		// No relation: the row names no one article, so it says no verbinding of its own.
		expect(row.relation).toBeUndefined();
	});

	it('puts the day of a stuk in full before its articles', () => {
		const [row] = documentRows(CONCEPT);
		expect(row.ref).toEqual({ collection: 'documents', key: 'abc' });
		expect(row.context?.replace(/\u00a0/g, ' ')).toBe('15 september 2026, Art. 120 Gw');
		expect(row.date).toBeNull();
	});

	it('says one space for many, and the article of a one-law concept short', () => {
		expect(squash('De buitengewoon opsporingsambtenaar  een ')).toBe(
			'De buitengewoon opsporingsambtenaar een'
		);
		expect(squash('  ')).toBeNull();
		expect(articleLabel(CONCEPT, 'Art. 120 Gw')).toBe('Art. 120');
		const mixed = {
			...CONCEPT,
			articles: [
				{ ...CONCEPT.articles[0], display_name: 'Art. 1 BW' },
				...CONCEPT.articles.slice(1)
			]
		};
		expect(articleLabel(mixed, 'Art. 120 Gw')).toBe('Art. 120 Gw');
	});
});
