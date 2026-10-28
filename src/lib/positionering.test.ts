// One self-description everywhere (besluit 35): the same sentence in the title and
// description of the start page, the shared-link text, the heading and the footer; no
// "onderzoeksinstrument/werkomgeving", and no name of the maker.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { START } from '$lib/components/home/start';

const SENTENCE = 'Zie hoe wetten, rechtspraak en parlement samenhangen.';
const DESCRIPTION = `${SENTENCE.slice(0, -1)}: zoek een wet, uitspraak, Kamerstuk of dossier en volg de verbindingen.`;
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === 'fixtures' ? [] : files(path);
		return /\.(svelte|ts|json|html)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
	});
}

describe('the positioning of Concordans', () => {
	it('is one promise in the title and description of the start page and the shared-link text', () => {
		expect(read('src/app.html')).toContain(`content="${DESCRIPTION}"`);
		// The heading of the start page promises; the footer describes, in other words.
		expect(read('src/lib/components/layout/SiteFooter.svelte')).not.toContain(SENTENCE);
		expect(read('src/lib/components/layout/SiteFooter.svelte')).not.toContain(START.heading);
		const home = JSON.parse(read('src/lib/seo/spa-routes.json')).find(
			(r: { path: string }) => r.path === '/'
		);
		expect(home.description).toBe(DESCRIPTION);
		expect(home.title).toBe(`${SENTENCE.slice(0, -1)}, Concordans`);
	});

	it('uses none of the old descriptions and never the name of the maker', () => {
		const banned = /onderzoeksinstrument|onderzoeksproject|werkomgeving|werkplaats|wettenlezer/i;
		const maker = /\bTMvE\b/; // the address concordans@tmve.nl stays: it is where mail goes
		const found = files(join(process.cwd(), 'src')).filter((f) => {
			const text = readFileSync(f, 'utf8');
			return banned.test(text) || maker.test(text);
		});
		expect(found).toEqual([]);
	});
});
