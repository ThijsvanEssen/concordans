import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findPassage } from './find-passage';

describe('findPassage', () => {
	const fixture = (name: string) => readFileSync(`src/lib/fixtures/${name}`, 'utf8');

	it('finds the heading of an article in the artikelsgewijze toelichting', () => {
		const text = fixture('mvt-36327-excerpt.txt');
		const passage = findPassage(text, '1.1.3');
		expect(passage?.derived).toBe(true);
		expect(text.slice(passage!.start, passage!.end)).toBe('Artikel 1.1.3 [onschuldpresumptie]');
	});

	it('does not take a sentence that starts with the article for a heading', () => {
		const text = fixture('mvt-36327-excerpt.txt');
		expect(findPassage(text, '17')).toBeNull();
		expect(findPassage(text, '1.1')).toBeNull();
	});

	it('finds a heading of the amending law that names the article', () => {
		const text = 'Algemeen\n  Artikel I, onderdeel C (artikel 287 Sr)\n  De wijziging ...';
		const passage = findPassage(text, '287');
		expect(text.slice(passage!.start, passage!.end)).toBe(
			'Artikel I, onderdeel C (artikel 287 Sr)'
		);
	});

	it('gives nothing when the toelichting is ordered by the amending law only', () => {
		expect(findPassage(fixture('mvt-36693-excerpt.txt'), '22b')).toBeNull();
	});
});
