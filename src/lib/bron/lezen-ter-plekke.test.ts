// Reading in place is one thing wherever it happens (Thijs, 14 Oct: an r.o. "kort in de
// kantlijn"): an r.o. is read through one component, a Kamerstuk's core text through one
// function, and the place of a verbinding in its source is read from its meta one way. Equal
// places, equal experience: each guard names where the one form lives.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BodyItem } from '$lib/components/explore/readers/judgment-text';
import { kernSoort, kernVan } from '$lib/components/open/rij-inhoud';
import { verbindingOfRow } from '$lib/verbonden/verbinding';
import { plaatsVanMeta } from '$lib/verbonden/edge-meta';
import { GROUPS } from '$lib/verbonden/groups';
import type { GraphNode } from '$lib/graph/types';
import { isOverwegingRef, tekstVanOverweging, type Uitspraak } from './overweging';

const ROOT = join(process.cwd(), 'src');
function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}
const sources = files(ROOT)
	.filter((path) => !path.includes(join('lib', 'api', 'generated')))
	.map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }));
const bron = (path: string) => sources.find((s) => s.path === path)?.text ?? '';
const waar = (test: (text: string) => boolean) =>
	sources.filter(({ text }) => test(text)).map((s) => s.path);

describe('an r.o. read in place', () => {
	it('is laid out by one component, Overweging, wherever it opens', () => {
		// The overweging an anchor names is found in two places only: the shared module and the
		// component that shows it.
		expect(waar((t) => /\boverwegingVan\(/.test(t)).sort()).toEqual([
			'lib/bron/Overweging.svelte',
			'lib/bron/overweging.ts',
			'lib/map/inhoud.ts'
		]);
		// Gemarkeerd and the card of a reference both show it with Overweging.
		for (const path of ['lib/map/MapInhoud.svelte', 'lib/bron/OverwegingKaart.svelte'])
			expect(bron(path)).toMatch(/import Overweging from '[^']*Overweging\.svelte'/);
	});

	it('is the card of every reference to a judgment at an r.o.', () => {
		expect(bron('lib/bron/BronLink.svelte')).toMatch(/import OverwegingKaart from/);
		expect(isOverwegingRef('judgments/ecli_nl_hr_2019_2006', 'rov-2.2.1')).toBe(true);
		expect(isOverwegingRef('judgments/ecli_nl_hr_2019_2006', null)).toBe(false);
		expect(isOverwegingRef('articles/bwbr0005537_3_4', 'lid-2')).toBe(false);
	});

	it('is the r.o. of a row’s line in Verbonden: a BronLink, not a bare link', () => {
		const v = bron('lib/verbonden/Verbonden.svelte');
		expect(v).toMatch(/<BronLink[\s\S]{0,200}at=\{hoe\.plaats\.at\}/);
	});

	it('gives the words of the overweging for a card of words', () => {
		const items: BodyItem[] = [
			{ kind: 'rov', num: '4', subTitle: null, body: 'Vorige.', id: 'rov-4' },
			{ kind: 'rov', num: '5', subTitle: null, body: 'Het beroep is gegrond.', id: 'rov-5' },
			{ kind: 'prose', body: 'Daarom wordt het besluit vernietigd.', within: true },
			{ kind: 'rov', num: '6', subTitle: null, body: 'Volgende.', id: 'rov-6' }
		];
		const u = { j: {} as Uitspraak['j'], items, noten: new Map() };
		expect(tekstVanOverweging(u, 'rov-5')).toBe(
			'Het beroep is gegrond. Daarom wordt het besluit vernietigd.'
		);
		expect(tekstVanOverweging(u, 'rov-9')).toBeNull();
	});
});

describe('a Kamerstuk opened in place', () => {
	it('shows one core text, from kernVan, in every list that opens it', () => {
		expect(bron('lib/components/open/requests.ts')).toMatch(/kernVan\(/);
		expect(bron('lib/map/MapInhoud.svelte')).toMatch(/kernVan\(/);
		// Verbonden and Bronnen open a stuk with RijInhoud, by the stuk's own kind.
		for (const path of [
			'lib/verbonden/Verbonden.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(bron(path)).toMatch(/<RijInhoud[\s\S]{0,300}als="kern"/);
		// No list reads a stuk's opening or dictum its own way; the overview of a topic codes its
		// decisions by the dictum, a column of its export, not a row opened.
		const eigen = [
			'lib/components/open/rij-inhoud.ts',
			'lib/onderwerpen/strekking.ts',
			'routes/(main)/onderwerpen/overzicht/+page.svelte'
		];
		expect(
			waar((t) => /\b(openingVan|toelichtingVan|dictumUit)\(/.test(t)).filter(
				(p) => !eigen.includes(p)
			)
		).toEqual([]);
	});

	it('opens a motie on its dictum, an amendement on its toelichting, another on its opening', () => {
		expect(kernSoort('Motie (gewijzigd/nader)')).toBe('dictum');
		expect(kernSoort('Amendement')).toBe('toelichting');
		expect(kernSoort('Brief regering')).toBe('opening');
		const motie =
			'De Kamer,\n\ngehoord de beraadslaging,\n\nconstaterende dat het kabinet niets doet;\n\nverzoekt de regering de wet te herzien,\n\nen gaat over tot de orde van de dag.';
		expect(kernVan('dictum', { text: motie })).toBe('verzoekt de regering de wet te herzien');
		expect(kernVan('dictum', { text: motie, dictum: 'verzoekt de regering' })).toBe(
			'verzoekt de regering'
		);
	});
});

describe('the place of a verbinding in its source', () => {
	it('is read from the light meta’s paragraphs, on the canvas line and on the card', () => {
		expect(plaatsVanMeta({ paragraphs: ['6', '7'] }, 'judgments/ecli_nl_rvs_2015_41')).toEqual({
			position: 'r.o. 6 en 7',
			at: 'rov-6'
		});
		expect(
			plaatsVanMeta({ paragraph_number: '5.1', paragraph_id: 'rov-5.1' }, 'ecli_nl_hr_2019_2006')
		).toEqual({ position: 'r.o. 5.1', at: 'rov-5.1' });
		expect(plaatsVanMeta({}, 'x')).toEqual({ position: null, at: null });
		expect(bron('lib/components/graph/GraphCanvas.svelte')).toMatch(/readEdge\(/);
		expect(bron('lib/components/graph/GraphCanvas.svelte')).not.toMatch(/meta\.paragraph_number/);
	});

	it('opens Lees bij r.o. N at the r.o. where the selected judgment cites the row’s article', () => {
		const selection = {
			id: 'judgments/ecli_nl_rvs_2015_41',
			collection: 'judgments',
			key: 'ecli_nl_rvs_2015_41',
			kind: 'judgment',
			label: 'ABRvS 14 januari 2015'
		} as GraphNode;
		const v = verbindingOfRow(
			{
				ref: { collection: 'articles', key: 'bwbr0005537_8_51d' },
				title: 'Artikel 8:51d Awb',
				context: null,
				kind: 'artikelen',
				relation: 'REFERS_TO',
				direction: 'outbound',
				position: 'r.o. 1 en 7',
				passageAt: 'rov-1'
			},
			selection
		);
		expect(v?.at).toBe('rov-1');
	});
});

describe('a judgment that cites an article', () => {
	it('opens beside the article, as its toelichting does', () => {
		const g = GROUPS.articles?.find((x) => x.id === 'judgments');
		expect(g?.inPlace).toBe(true);
	});
});
