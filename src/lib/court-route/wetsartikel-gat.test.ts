// Guard (B144): a court without its article of law shows the same visible gap in the Verloop
// of a judgment and on Rechtsgang (its stages and the entries into the Hoge Raad, both by
// CourtArticles), from the one component.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const PLACES = {
	Verloop: read('../bron/CourseList.svelte'),
	Rechtsgang: read('./CourtArticles.svelte')
};
const USERS = [
	read('../../routes/(main)/rechtspraak/rechtsgang/+page.svelte'),
	read('./CassationEntries.svelte')
];

describe('the gap of an article of law', () => {
	it.each(Object.entries(PLACES))('%s shows it with WetsartikelGat', (_, source) => {
		expect(source).toContain("import WetsartikelGat from '$lib/court-route/WetsartikelGat.svelte'");
		expect(source).toContain('<WetsartikelGat');
		expect(source).not.toMatch(/wetsartikel \{NOT_IN_DATA\}/);
	});

	it.each(Object.entries(PLACES))('%s links an article by its readable address', (_, source) => {
		expect(source).toMatch(/Href\([^)]*\{ path: \w+\.path \}\)/);
	});

	it('Rechtsgang names the articles of a court by CourtArticles alone', () => {
		for (const source of USERS) expect(source).toContain('<CourtArticles');
	});
});
