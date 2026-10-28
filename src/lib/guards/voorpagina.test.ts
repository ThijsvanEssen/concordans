// The footer and the documentation as the proposals of 28 Oct 2026 set them: three columns
// of ways in and no links away; the documentation from the first step to what lies elsewhere.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8');

describe('the footer', () => {
	const foot = read('lib/components/layout/SiteFooter.svelte');

	it('has three columns, Gebruiken, Uitleg and Over, each with its links', () => {
		const kolommen = [...foot.matchAll(/kop: '([^']+)',\s*links: \[([\s\S]*?)\]\s*\}/g)];
		expect(kolommen.map((k) => k[1])).toEqual(['Gebruiken', 'Uitleg', 'Over']);
		const labels = kolommen.map((k) => [...k[2].matchAll(/label: '([^']+)'/g)].map((m) => m[1]));
		expect(labels).toEqual([
			['Zoeken', 'Netwerk', 'Actueel', 'Bundels'],
			['Documentatie', 'Methode', 'API'],
			[
				'Over Concordans',
				'Bronnen en hergebruik',
				'Voorwaarden',
				'Privacy',
				'Fout gevonden? Mail ons'
			]
		]);
	});

	it('leads nowhere outside Concordans but to the mail address', () => {
		expect(foot).not.toMatch(/href="https?:/);
		expect(foot).not.toContain('Officiële bronnen');
		expect(foot).toContain('`mailto:${CONTACT_EMAIL}`');
	});

	it('does not repeat the heading of the start page in its blurb', () => {
		expect(foot).toContain('Wetten, uitspraken en Kamerstukken, met hun onderlinge verbindingen.');
		expect(foot).toContain('zonder account, zonder cookies');
	});
});

describe('the documentation', () => {
	const docs = read('routes/(main)/docs/+page.svelte');

	it('goes from the first steps to what lies elsewhere, in this order', () => {
		const koppen = [...docs.matchAll(/<Sectie title="([^"]+)" niveau=\{2\}/g)].map((m) => m[1]);
		expect(koppen).toEqual([
			'Begin hier',
			'Woordenlijst',
			'Iets vinden',
			'Een bron lezen',
			'Verbanden volgen',
			'Bewaren en delen',
			'Naslag',
			'Elders'
		]);
	});

	it('has the route of five steps, and a way to every heading', () => {
		expect(docs.match(/<ol class="route">([\s\S]*?)<\/ol>/)?.[1].match(/<li>/g)).toHaveLength(5);
		expect(docs).toContain('<Inhoudsopgave items={KOPPEN}');
		for (const m of docs.matchAll(/id: '([^']+)'/g)) expect(docs, m[1]).toContain(`id="${m[1]}"`);
	});

	it('lists every relation, from the vocabulary, without asking the API', () => {
		expect(docs).toContain('{#each RELATIONS as relation');
		expect(docs).not.toContain('getStats');
	});
});
