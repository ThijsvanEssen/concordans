// The head of every reader is the frame's (E8, C1): a kind gives data and words to ReaderHead,
// never a line of its own above the title, a status line left empty, nor a table of contents,
// a group count or an empty state in its own form.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the head of a reader', () => {
	it('gives the line above the title as data: kindLabel, kindParts, kindTerm, never a snippet', () => {
		expect(overtreders((t) => /\{#snippet kindLine\b|\bkindLine=/.test(t), [])).toEqual([]);
		const hoofd = bron('lib/components/explore/readers/ReaderHead.svelte');
		// Glyph and the link to the list of the kind come from the one place, SoortLink.
		expect(hoofd).toMatch(/<SoortLink\b/);
		expect(hoofd).toMatch(/kindParts/);
	});

	it('gives a place (Titel, Afdeling) only in the reader of an article', () => {
		expect(
			overtreders(
				(t) => /<ReaderHead[^>]*\splace=/.test(t) || /\n\s+place=\{/.test(t),
				[plek('lib/components/explore/readers/ArticleReader.svelte', 'an article has its place')]
			)
		).toEqual([]);
	});

	it('puts Bewaar before what only one kind has (Volg)', () => {
		const acties = bron('lib/components/explore/readers/KopActies.svelte');
		const bewaar = acties.indexOf('<Bewaar ');
		expect(bewaar).toBeGreaterThan(0);
		expect(bewaar).toBeLessThan(acties.indexOf('<FollowDossier'));
		expect(bewaar).toBeLessThan(acties.indexOf('<Follow '));
	});

	it('leaves Verbonden without a unit in the count and without Alle N for what is shown', () => {
		const samenvatting = bron('lib/verbonden/KindSummary.svelte');
		expect(samenvatting).not.toMatch(/k\.id === 'laws'/);
		expect(samenvatting).toMatch(/\{#if k\.count > PREVIEW_ROWS\}/);
	});

	it('shows no table of contents of one line, and says nothing of one that is empty', () => {
		expect(overtreders((t) => /Geen indeling/.test(t), [])).toEqual([]);
		for (const naam of ['LezenNav', 'DocumentToc', 'JudgmentToc'])
			expect(bron(`lib/components/explore/${naam}.svelte`), naam).toMatch(/reportContents\(/);
		// The type of a row and of a division in the contents is NavKolom's: the three give only
		// the level (the springlijst of the overwegingen is the uitspraak's own).
		expect(bron('lib/components/explore/DocumentToc.svelte')).not.toMatch(
			/font-(weight|size|style)/
		);
		for (const naam of ['LezenNav', 'DocumentToc', 'JudgmentToc'])
			expect(bron(`lib/components/explore/${naam}.svelte`), naam).not.toMatch(
				/\.nav-kolom__rij\s*\{/
			);
	});

	it('draws the band only for a kind that has one, and no bare rule', () => {
		const kader = bron('lib/components/explore/readers/ReaderFrame.svelte');
		expect(kader).toMatch(/bandAlways\(/);
		expect(kader).toMatch(/hidden=\{!rowShown\}/);
	});
	it('floats the actions at the right of the title, before it in the code, in the app and in the first paint (Lezerkop, A281)', () => {
		const hoofd = bron('lib/components/explore/readers/ReaderHead.svelte');
		// Before the h1 in the code, so the h1 stays the first heading and a long title gives way
		// on its first line only.
		expect(hoofd.indexOf('class="reader-status__acties"')).toBeGreaterThan(0);
		expect(hoofd.indexOf('class="reader-status__acties"')).toBeLessThan(
			hoofd.indexOf('<h1 class="reader-title"')
		);
		expect(hoofd).toMatch(/\.reader-status__acties \{[^}]*float: right/);
		expect(hoofd).toMatch(/\.reader-status__acties \{[^}]*var\(--s-4\)/);
		const paint = bron('lib/first-paint/markup.ts');
		expect(paint.indexOf('reader-status__acties')).toBeLessThan(
			paint.indexOf('<h1 class="reader-title')
		);
		const artikel = bron('lib/first-paint/article.ts');
		expect(artikel.indexOf('reader-status__acties')).toBeLessThan(
			artikel.indexOf('<h1 class="reader-title')
		);
	});

	it('draws the stand and the facts as one block under one rule, and one step of s-5 to the text', () => {
		const hoofd = bron('lib/components/explore/readers/ReaderHead.svelte');
		expect(hoofd).toMatch(/\.reader-status \{[^}]*border-top: 1px solid var\(--rule\)/);
		// No second rule between the status and the strip of facts.
		expect(hoofd).not.toMatch(/\.reader-facts \{[^}]*border-top/);
		expect(hoofd).toMatch(/\.reader-head \{[^}]*var\(--s-5\) - var\(--lezer-stap/);
		// An empty row under the title or under the status takes no room.
		expect(hoofd).toMatch(/\.reader-onder:empty,\s*\.reader-rijen:empty \{\s*display: none/);
	});
});
