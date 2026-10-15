// The table Pages of docs/routes.md names every page of src/routes, and only those.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

/** A page's address: its route folder without the groups, `/` for the root. */
const adresVan = (path: string) =>
	'/' +
	path
		.replace(/^routes\//, '')
		.replace(/\/?\+page\.svelte$/, '')
		.split('/')
		.filter((deel) => deel && !/^\(.*\)$/.test(deel))
		.join('/');

const PAGINAS = BRONNEN.filter((b) => /^routes\/(.*\/)?\+page\.svelte$/.test(b.path)).map((b) =>
	adresVan(b.path)
);

/** The addresses in the first column of the table Pages. */
function inDocs(): string[] {
	const tekst = readFileSync(join(process.cwd(), 'docs/routes.md'), 'utf8');
	const tabel = tekst.split('## Pages')[1].split('\n## ')[0];
	return tabel
		.split('\n')
		.filter((regel) => regel.startsWith('|'))
		.flatMap((regel) => [...regel.split('|')[1].matchAll(/`(\/[^`]*)`/g)].map((m) => m[1]));
}

describe('docs/routes.md', () => {
	it('names every page and no other', () => {
		expect(PAGINAS.length).toBeGreaterThan(10);
		expect([...new Set(inDocs())].sort()).toEqual([...PAGINAS].sort());
	});
});
