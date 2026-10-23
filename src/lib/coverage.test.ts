// One mark for what the dataset lacks (besluit 23): the words "niet ingelezen", "niet in de
// gegevens" and "geen … in de gegevens" live in coverage.ts, the one vocabulary of Dekking and Waarde. A place that writes
// them in its own words fails; the count of those left only goes down.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	anchorLine,
	coverageLine,
	lacks,
	noneHeld,
	notHeld,
	searchedLine
} from '$lib/text/coverage';

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

const OWN = new Set(['lib/text/coverage.ts']);

// The places that keep their own words, each for a reason of its own.
const STILL_OWN: Record<string, number> = {
	// Prose that explains the open mark of the network to the reader, not the mark itself.
	'routes/(main)/docs/+page.svelte': 1
};

describe('the mark of what is missing', () => {
	it('is written only in Waarde and Dekking', () => {
		const found: Record<string, number> = {};
		for (const path of files(ROOT)) {
			const rel = relative(ROOT, path);
			if (OWN.has(rel)) continue;
			const n = [
				...code(readFileSync(path, 'utf8')).matchAll(
					/niet ingelezen|(?:niet|geen [a-z']+) in de gegevens/gi
				)
			].length;
			if (n > 0) found[rel] = n;
		}
		expect(found).toEqual(STILL_OWN);
	});

	it('says where an arcering is now, in one line, never silently', () => {
		expect(anchorLine({ state: 'moved', place: 'lid 3' })).toBe('Nu in lid 3');
		expect(anchorLine({ state: 'changed', since: '2026-07-01' })).toBe(
			'Tekst gewijzigd per 1\u00a0juli\u00a02026'
		);
		expect(anchorLine({ state: 'lapsed', since: '2026-07-01' })).toBe(
			'Vervallen per 1\u00a0juli\u00a02026'
		);
		expect(anchorLine({ state: 'lost' })).toBe('Passage niet meer in de tekst');
		// Its words live here alone: no other file writes them.
		const found = files(ROOT).filter(
			(path) =>
				!OWN.has(relative(ROOT, path)) &&
				/Passage niet meer in de tekst|Tekst gewijzigd per/.test(code(readFileSync(path, 'utf8')))
		);
		expect(found).toEqual([]);
	});

	it('says a part or a bron the dataset lacks in the same words everywhere', () => {
		expect(lacks('onderwerp')).toBe('Onderwerp niet in de gegevens');
		expect(notHeld('Dit dossier')).toBe('Dit dossier staat niet in de gegevens');
		expect(noneHeld('artikelen')).toBe('geen artikelen in de gegevens');
		expect(coverageLine(null, { noText: true })).toBe('Tekst niet in de gegevens');
	});

	it('says why a Kamerstuk has no text, as the API knows it', () => {
		type State = 'pending' | 'not_in_source' | 'none' | 'not_fetched';
		type Reason = 'awaiting_normalize' | 'source_pdf_only';
		const without = (state: State, as_of: string | null = null, reason: Reason | null = null) =>
			coverageLine(
				{
					text: { state, as_of, reason },
					paragraphs: { state, as_of, reason },
					tables: { state, as_of, reason }
				},
				{ noText: true }
			);
		expect(without('pending')).toBe('Tekst nog niet beschikbaar');
		expect(without('pending', '2026-10-20T03:00:00Z')).toBe('Tekst nog niet beschikbaar');
		expect(without('not_in_source')).toBe('Tekst niet in de gegevens, de bron levert geen tekst');
		expect(without('none', '2026-10-20T03:00:00Z')).toBe('Geen leesbare tekst in de bron');
		// Why it is pending, where the API says so (from 0.79.68).
		expect(without('pending', '2026-10-20T03:00:00Z', 'awaiting_normalize')).toBe(
			'Tekst nog niet beschikbaar, ontvangen op 20\u00a0oktober\u00a02026'
		);
		expect(without('pending', '2026-10-20T03:00:00Z', 'source_pdf_only')).toBe(
			'Tekst nog niet beschikbaar, de bron heeft alleen de pdf'
		);
		// A paper of the Eerste Kamer, a publication: the source has it, the dataset not.
		expect(without('not_fetched')).toBe('Tekst alleen bij de bron');
		expect(coverageLine({ text: { state: 'not_fetched' } }, { noText: true })).toBe(
			'Tekst alleen bij de bron'
		);
		// With its text, what of it is not read yet; paragraphs or tables it has none of, nothing.
		expect(
			coverageLine({
				text: { state: 'done' },
				paragraphs: { state: 'pending' },
				tables: { state: 'pending' }
			})
		).toBe("Alinea's en tabellen nog niet beschikbaar");
		expect(
			coverageLine({
				text: { state: 'done' },
				paragraphs: { state: 'done' },
				tables: { state: 'none' }
			})
		).toBe(null);
	});

	it('says how many references of a text are not linked, and nothing where all are', () => {
		expect(coverageLine({ references: { state: 'partial', missing: 3 } })).toBe(
			'3 verwijzingen nog niet gekoppeld'
		);
		expect(coverageLine({ references: { state: 'partial', missing: 1 } })).toBe(
			'1 verwijzing nog niet gekoppeld'
		);
		expect(coverageLine({ references: { state: 'done' } })).toBe(null);
	});

	it('says of references to a text not loaded yet that they wait for it (target_not_loaded)', () => {
		expect(
			coverageLine({ references: { state: 'partial', missing: 4, reason: 'target_not_loaded' } })
		).toBe('4 verwijzingen naar tekst die niet in de gegevens staat');
		expect(
			coverageLine({ references: { state: 'partial', missing: 1, reason: 'target_not_loaded' } })
		).toBe('1 verwijzing naar tekst die niet in de gegevens staat');
		expect(coverageLine({ references: { state: 'partial', reason: 'target_not_loaded' } })).toBe(
			'Verwijzingen deels naar tekst die niet in de gegevens staat'
		);
	});

	it('says of an open bill that no end is recorded, not that it runs', () => {
		expect(coverageLine({ outcome: { state: 'pending', as_of: '2019-03-05' } })).toBe(
			'Geen einde vastgelegd, laatste activiteit 5\u00a0maart\u00a02019'
		);
		expect(coverageLine({ outcome: { state: 'pending', as_of: null } })).toBe(
			'Uitkomst nog niet beschikbaar'
		);
		expect(coverageLine({ outcome: { state: 'not_in_source' } })).toBe(null);
		expect(coverageLine({ outcome: { state: 'done', as_of: '2019-03-05' } })).toBe(null);
		// A dossier from an API without the part: nothing, no failure.
		expect(coverageLine({})).toBe(null);
	});

	it('says what is missing in one line, with a date where the API gives one', () => {
		expect(coverageLine({ versions: { state: 'not_in_source', as_of: '2016-04-27' } })).toBe(
			'Tekst zoals vastgesteld op 27\u00a0april\u00a02016, latere wijzigingen niet verwerkt'
		);
		expect(coverageLine({ versions: { state: 'not_in_source', as_of: null } })).toBe(
			'Tekst zoals vastgesteld, latere wijzigingen niet verwerkt'
		);
	});

	it('says what of a law of the Staatsblad is read, and nothing where all is', () => {
		expect(coverageLine({ references: { state: 'partial', missing: 1234 } })).toBe(
			'1.234 verwijzingen nog niet gekoppeld'
		);
		expect(coverageLine({ definitions: { state: 'pending' } })).toBe(
			'Begrippen nog niet beschikbaar'
		);
		expect(
			coverageLine({ references: { state: 'pending' }, definitions: { state: 'pending' } })
		).toBe('Verwijzingen en begrippen nog niet beschikbaar');
		expect(
			coverageLine({
				references: { state: 'partial', missing: 12 },
				definitions: { state: 'pending' }
			})
		).toBe('12 verwijzingen nog niet gekoppeld, begrippen nog niet beschikbaar');
		expect(coverageLine({ references: { state: 'done' }, definitions: { state: 'done' } })).toBe(
			null
		);
		expect(coverageLine(null)).toBe(null);
	});

	it('says a part the reader already shows some of is read in part, not yet at all', () => {
		// Sv 2.8.6 (Stb. 2026, 56): references pending, and one laid to 2.8.16 in its text.
		const sv = { references: { state: 'pending' }, definitions: { state: 'pending' } } as const;
		expect(coverageLine(sv, { shown: { references: 1 } })).toBe(
			'Verwijzingen deels beschikbaar, begrippen nog niet beschikbaar'
		);
		expect(coverageLine(sv, { shown: { references: 1, definitions: 2 } })).toBe(
			'Verwijzingen en begrippen deels beschikbaar'
		);
		expect(coverageLine(sv, { shown: { references: 0 } })).toBe(
			'Verwijzingen en begrippen nog niet beschikbaar'
		);
	});

	it('says of a source the runs no longer fetch from how far it goes', () => {
		const at = '2026-10-08T20:53:06Z';
		expect(coverageLine({ source: { state: 'paused', as_of: at } })).toBe(
			'Wordt niet meer bijgewerkt, stand 8\u00a0oktober\u00a02026'
		);
		expect(coverageLine({ source: { state: 'unavailable', as_of: at } }, { of: 'HUDOC' })).toBe(
			'HUDOC onbereikbaar, stand 8\u00a0oktober\u00a02026'
		);
		expect(coverageLine({ source: { state: 'pending', as_of: null } })).toBe(
			'Nog niet beschikbaar'
		);
		expect(coverageLine({ source: { state: 'done', as_of: at } }, { of: 'HUDOC' })).toBe(null);
	});

	it('says what a search reads, in the order the API names it', () => {
		const none = { state: 'none' as const, as_of: null, missing: null, reason: null };
		expect(
			searchedLine({ fields: ['title', 'number'], signed_for: [], completeness: { text: none } })
		).toBe('Gezocht in titels en nummers, niet in de tekst');
		expect(
			searchedLine({
				fields: ['title', 'name', 'number', 'summary'],
				signed_for: [],
				completeness: { text: none }
			})
		).toBe('Gezocht in titels, namen, nummers en inhoudsindicaties, niet in de tekst');
		expect(
			searchedLine({
				fields: ['title', 'number', 'text'],
				signed_for: [],
				completeness: { text: { ...none, state: 'done' } }
			})
		).toBe('Gezocht in titels, nummers en de tekst');
		expect(searchedLine({ fields: ['name'], signed_for: [], completeness: {} })).toBe(
			'Gezocht in namen'
		);
		expect(searchedLine(undefined)).toBe(null);
	});

	it('says by whom the stukken and stemmingen of a query naming a fractie are (signed_for)', () => {
		const vvd = { words: 'vvd', name: 'VVD', factions: ['vvd'] };
		expect(searchedLine({ fields: ['title', 'text'], completeness: {}, signed_for: [vvd] })).toBe(
			'Gezocht in titels en de tekst, door VVD'
		);
		expect(
			searchedLine({
				fields: ['title'],
				completeness: {},
				signed_for: [vvd, { words: 'bbb', name: 'BBB', factions: ['bbb'] }]
			})
		).toBe('Gezocht in titels, door VVD en BBB');
		expect(searchedLine({ fields: ['title'], completeness: {}, signed_for: [] })).toBe(
			'Gezocht in titels'
		);
	});
});
