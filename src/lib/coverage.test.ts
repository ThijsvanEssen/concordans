// One mark for what the dataset lacks (besluit 23): the words "niet ingelezen" and "niet in de
// gegevens" live in Waarde and Dekking. The places that still write their own are counted
// here, per file, until they move to Dekking (transparantie P4); the count only goes down,
// and a new place fails.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverageLine, searchedLine } from '$lib/components/ui/coverage';

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

const OWN = new Set(['lib/components/ui/Waarde.svelte', 'lib/components/ui/coverage.ts']);

// The places that still say it in their own words: P4 moves them to Dekking.
const STILL_OWN: Record<string, number> = {
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
		expect(found).toEqual(STILL_OWN);
	});

	it('says what is missing in one line, with a date where the API gives one', () => {
		expect(coverageLine({ text: { state: 'none' } })).toBe('Tekst niet ingelezen');
		expect(coverageLine({ versions: { state: 'not_in_source', as_of: '2016-04-27' } })).toBe(
			'Tekst zoals vastgesteld op 27 april 2016, latere wijzigingen niet verwerkt'
		);
		expect(coverageLine({ versions: { state: 'not_in_source', as_of: null } })).toBe(
			'Tekst zoals vastgesteld, latere wijzigingen niet verwerkt'
		);
	});

	it('says what of a law of the Staatsblad is read, and nothing where all is', () => {
		expect(coverageLine({ references: { state: 'partial', missing: 1234 } })).toBe(
			'Verwijzingen naar andere wetten deels gelegd, 1.234 niet herkend'
		);
		expect(coverageLine({ definitions: { state: 'pending' } })).toBe('Begrippen nog niet verwerkt');
		expect(
			coverageLine({ references: { state: 'pending' }, definitions: { state: 'pending' } })
		).toBe('Verwijzingen en begrippen nog niet verwerkt');
		expect(
			coverageLine({
				references: { state: 'partial', missing: 12 },
				definitions: { state: 'pending' }
			})
		).toBe(
			'Verwijzingen naar andere wetten deels gelegd, 12 niet herkend, begrippen nog niet verwerkt'
		);
		expect(coverageLine({ references: { state: 'done' }, definitions: { state: 'done' } })).toBe(
			null
		);
		expect(coverageLine(null)).toBe(null);
	});

	it('says of a source the runs no longer fetch from how far it goes', () => {
		const at = '2026-10-08T20:53:06Z';
		expect(coverageLine({ source: { state: 'paused', as_of: at } })).toBe(
			'Gepauzeerd, bijgewerkt tot 8 oktober 2026'
		);
		expect(coverageLine({ source: { state: 'unavailable', as_of: at } }, 'HUDOC')).toBe(
			'HUDOC onbereikbaar, bijgewerkt tot 8 oktober 2026'
		);
		expect(coverageLine({ source: { state: 'pending', as_of: null } })).toBe('Nog niet opgehaald');
		expect(coverageLine({ source: { state: 'done', as_of: at } }, 'HUDOC')).toBe(null);
	});

	it('says what a search reads, in the order the API names it', () => {
		const none = { state: 'none' as const, as_of: null, missing: null };
		expect(searchedLine({ fields: ['title', 'number'], completeness: { text: none } })).toBe(
			'Gezocht in titels en nummers, niet in de tekst'
		);
		expect(
			searchedLine({
				fields: ['title', 'name', 'number', 'summary'],
				completeness: { text: none }
			})
		).toBe('Gezocht in titels, namen, nummers en inhoudsindicaties, niet in de tekst');
		expect(
			searchedLine({
				fields: ['title', 'number', 'text'],
				completeness: { text: { ...none, state: 'done' } }
			})
		).toBe('Gezocht in titels, nummers en de tekst');
		expect(searchedLine({ fields: ['name'], completeness: {} })).toBe('Gezocht in namen');
		expect(searchedLine(undefined)).toBe(null);
	});
});
