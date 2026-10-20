// One mark for what the dataset lacks (besluit 23): the words "niet ingelezen" and "niet in de
// gegevens" live in Waarde and Dekking. The places that still write their own are counted
// here, per file, until they move to Dekking (transparantie P4); the count only goes down,
// and a new place fails.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dekkingZin } from '$lib/components/ui/dekking';

const ROOT = join(process.cwd(), 'src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === 'generated' ? [] : files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

/** The source without its comments: a comment may name the words. */
const code = (text: string) =>
	text
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const OWN = new Set(['lib/components/ui/Waarde.svelte', 'lib/components/ui/dekking.ts']);

// The places that still say it in their own words: P4 moves them to Dekking.
const NOG_EIGEN: Record<string, number> = {
	'lib/bron/DossierLink.svelte': 1,
	'lib/bron/OverwegingKaart.svelte': 1,
	'lib/bron/behoort-procesgang.ts': 1,
	'lib/bron/describe.ts': 2,
	'lib/components/articles/ArticleText.svelte': 1,
	'lib/components/articles/VersionCompare.svelte': 1,
	'lib/components/explore/WholeLawReaderArticle.svelte': 1,
	'lib/components/explore/index/CabinetOccupancy.svelte': 4,
	'lib/components/explore/index/KabinettenStrook.svelte': 1,
	'lib/components/explore/index/rows/DossierRows.svelte': 1,
	'lib/components/explore/index/rows/InstrumentRows.svelte': 1,
	'lib/components/explore/readers/ArticleReader.svelte': 3,
	'lib/components/explore/readers/DecisionReader.svelte': 2,
	'lib/components/explore/readers/DocumentReader.svelte': 1,
	'lib/components/explore/readers/JudgmentReader.svelte': 2,
	'lib/components/graph/CanvasHoverCard.svelte': 1,
	'lib/components/open/RijInhoud.svelte': 2,
	'lib/components/open/Wijzigingen.svelte': 2,
	'lib/components/parliamentary/stand.ts': 1,
	'lib/components/parliamentary/stemming.ts': 1,
	'lib/components/tijdlijn/tijdas.ts': 1,
	'lib/map/MapInhoud.svelte': 3,
	'lib/search/Search.svelte': 1,
	'lib/verbonden/rows.ts': 2,
	'routes/(main)/docs/+page.svelte': 1,
	'routes/explore/+page.svelte': 2
};

describe('the mark of what is missing', () => {
	it('is written only in Waarde and Dekking', () => {
		const found: Record<string, number> = {};
		for (const path of files(ROOT)) {
			const rel = relative(ROOT, path);
			if (OWN.has(rel)) continue;
			const n = [
				...code(readFileSync(path, 'utf8')).matchAll(/niet ingelezen|niet in de gegevens/gi)
			].length;
			if (n > 0) found[rel] = n;
		}
		expect(found).toEqual(NOG_EIGEN);
	});

	it('says what is missing in one line, with a date where the API gives one', () => {
		expect(dekkingZin({ onderdeel: 'text', state: 'none' })).toBe('Tekst niet ingelezen');
		expect(dekkingZin({ onderdeel: 'versions', state: 'not_in_source', as_of: '2016-04-27' })).toBe(
			'Tekst zoals vastgesteld op 27 april 2016, latere wijzigingen niet verwerkt'
		);
		expect(dekkingZin({ onderdeel: 'versions', state: 'not_in_source', as_of: null })).toBe(
			'Tekst zoals vastgesteld, latere wijzigingen niet verwerkt'
		);
	});
});
