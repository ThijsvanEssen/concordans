// Every reader alike: one head, one frame, one way to load, one way to show its notes.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek, regels } from '$lib/test/bronnen';

describe('the readers', () => {
	it('sets footnotes by one component in every reader (Voetnoten, CitedText `noten`)', () => {
		// A judgment, a Kamerstuk and an overweging read in place (its card, Gemarkeerd) show
		// their notes alike: the marker in CitedText, the notes in Voetnoten, one open note.
		const lezers = [
			'lib/components/explore/readers/JudgmentReader.svelte',
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/Overweging.svelte'
		];
		for (const pad of lezers) {
			const t = bron(pad);
			expect(t, pad).toMatch(/<Voetnoten\b/);
			expect(t, pad).toMatch(/<CitedText\b[^>]*\bnoten=/);
			expect(t, pad).toMatch(/zetNootStand\(\)/);
		}
		// No other place draws a note or its marker of its own.
		expect(
			overtreders(
				(t) => /class="voetnoot"|class="noot-ref/.test(t),
				[
					plek('lib/components/articles/Voetnoten.svelte'),
					plek('lib/components/articles/CitedText.svelte')
				]
			)
		).toEqual([]);
		// The passage with its marked words is one component (Aanhaling) wherever a row or a card shows it.
		expect(overtreders((t) => /\.before\}<mark>|\{p\.before\}/.test(t))).toEqual([]);
	});

	it('gives a place in every text one menu, PlaatsMenu: a lid, an overweging, an alinea (A28)', () => {
		// A lid, an r.o. and an alinea of a Kamerstuk, in their reader and read in place in a
		// bundel: one menu (Citeer, Kopieer tekst, Bewaar with BundleChecklist), opened from the
		// place's marker or a click on its text (placeMarker, blockClick); no menu of their own.
		const plaatsen = [
			'lib/components/articles/ArticleText.svelte',
			'lib/components/explore/readers/JudgmentReader.svelte',
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/Overweging.svelte',
			'lib/bron/PaperParagraph.svelte'
		];
		for (const p of plaatsen) {
			const t = bron(p);
			expect(t, p).toMatch(
				/import PlaatsMenu, \{ placeMarker \} from '(?:\$lib\/components\/articles|\.)\/PlaatsMenu\.svelte'/
			);
			expect(t, p).toMatch(/<PlaatsMenu\b[\s\S]*?bewaar=\{[^}]*\}[\s\S]*?\/>/);
			expect(t, p).toContain('use:blockClick=');
			expect(t, p).toMatch(/class="[^"]*\bplaats-marker\b/);
		}
		expect(bron('lib/components/articles/PlaatsMenu.svelte')).toContain('<BundleChecklist');
		// An alinea is cited and kept one way, in its reader and in a bundel (paper-cite), and
		// cut from its text in one place (paperParagraphs, text/anchor.ts).
		for (const p of [
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/PaperParagraph.svelte'
		]) {
			expect(bron(p), p).toContain('paperParagraphCite(');
			expect(bron(p), p).toContain('paperParagraphs(');
		}
		expect(
			overtreders((t) => /matchAll\(\/\[\^\\n\]\+\/g\)/.test(t), [plek('lib/text/anchor.ts')])
		).toEqual([]);
	});

	it('heads every reader with ReaderHead, Bewaar in its place (Thijs, 10 Oct: gelijke pagina’s)', () => {
		// The head of a reader is one form: kind or place, title, status, and the actions at its
		// right (KopActies through ReaderHead, Bewaar always). No reader lays out actions itself.
		const lezers = BRONNEN.filter(
			({ path }) =>
				(/^lib\/components\/explore\/readers\/\w+Reader\.svelte$/.test(path) &&
					!path.endsWith('ReaderHead.svelte')) ||
				path === 'lib/components/explore/WholeLawReader.svelte'
		);
		expect(lezers.length).toBeGreaterThan(10);
		expect(
			lezers
				.filter(({ text }) => !/<ReaderHead[\s\S]*?acties=\{\{[\s\S]*?bewaar:/.test(text))
				.map((s) => s.path)
		).toEqual([]);
		expect(
			overtreders(
				(t) => /<KopActies\b/.test(t),
				[plek('lib/components/explore/readers/ReaderHead.svelte')]
			)
		).toEqual([]);
		// Every branch of a reader too (a bewindspersoon has its own lines): no reader file draws
		// a head of its own, and one that holds a title heads it with ReaderHead (Hosten, 10 Oct:
		// /leden/rob-jetten had no Bewaar).
		const map = BRONNEN.filter(({ path }) => path.startsWith('lib/components/explore/readers/'));
		expect(map.filter(({ text }) => /<header\b/.test(text)).map((s) => s.path)).toEqual([]);
		expect(
			map
				.filter(
					({ path, text }) =>
						!path.endsWith('ReaderHead.svelte') &&
						/<h[12]\b/.test(text) &&
						!/<ReaderHead\b/.test(text)
				)
				.map((s) => s.path)
		).toEqual([]);
		// The head ends without a rule of its own: the first section's rule is the one line.
		const kop = {
			path: 'lib/components/explore/readers/ReaderHead.svelte',
			text: bron('lib/components/explore/readers/ReaderHead.svelte')
		};
		expect(
			[...lezers, kop]
				.filter(({ text }) =>
					regels(text).some(
						(r) =>
							/reader-head|whole-head|(^|\s)\.head$/.test(r.selector) &&
							/border-bottom/.test(r.body)
					)
				)
				.map((s) => s.path)
		).toEqual([]);
	});

	it('starts every reader at one title column where no network stands beside it', () => {
		const regel = /\.explore-read:not\(\.explore-read--with-nav\) \.col--measure \{([^}]*)\}/.exec(
			bron('routes/explore/+page.svelte')
		)?.[1];
		expect(regel).toMatch(/--reader-col-left:\s*calc\([^;]*--nav-w\b/);
	});

	it('centres every reader between the side columns on a wide screen, through ReaderFrame', () => {
		// Thijs, 11 Oct: "De reader mag wel gecentreerd worden tussen de twee zijpanelen". The
		// column sets the margin for every reader alike; no reader frames itself.
		expect(bron('routes/explore/+page.svelte')).toMatch(
			/\.col--reader \{[^}]*--reader-col-left: auto;/
		);
		expect(bron('lib/components/explore/readers/ReaderFrame.svelte')).toMatch(
			/\.reader-frame__col \{[^}]*margin-left: var\(--reader-col-left, 0\);[^}]*margin-right: auto;/
		);
		const lezers = BRONNEN.filter(({ path }) =>
			/^lib\/components\/explore\/readers\/\w+Reader\.svelte$/.test(path)
		);
		expect(lezers.length).toBeGreaterThan(10);
		expect(lezers.filter(({ text }) => !/<ReaderFrame\b/.test(text)).map((s) => s.path)).toEqual(
			[]
		);
	});

	it('loads every reader one way: load() into ReaderFrame, which says loading and failure', () => {
		// Code-eenvoud F10: each reader had its own state machine, attempt counter and error
		// line, and CommitteeReader showed nothing at all when its request failed.
		const lezers = BRONNEN.filter(({ path }) =>
			/^lib\/components\/explore\/(readers\/\w+\.svelte|WholeLawReader\.svelte)$/.test(path)
		);
		const own = lezers
			.filter(({ text }) =>
				/let attempt = \$state|class="(?:error|spinner|whole-error|whole-empty)"|class="loading/.test(
					text
				)
			)
			.map((s) => s.path);
		expect(own).toEqual([]);
		const laders = [
			'Annex',
			'Article',
			'Cabinet',
			'Commitment',
			'Committee',
			'Decision',
			'Document',
			'Dossier',
			'Faction',
			'Judgment',
			'Member'
		].map((n) => `lib/components/explore/readers/${n}Reader.svelte`);
		const zonder = laders.filter(
			(path) => !/<ReaderFrame\b[^>]*\bstate=\{[^}]*\}[^>]*\bretry=/.test(bron(path))
		);
		expect(zonder).toEqual([]);
	});

	it('puts the actions of a reader on a row of their own, and keeps the line of a late phrase', () => {
		// Thijs, 10 Oct (approved suggestion 5): the status words have the column's width; a
		// phrase that comes after the text (the bills of an article) stands on a line kept from
		// the start, so it moves nothing (Sv 147: 22 px before, 0 at 375 and 1440 after).
		const kop = bron('lib/components/explore/readers/ReaderHead.svelte');
		expect(kop).toMatch(/\.reader-status \{[^}]*flex-direction: column;/);
		expect(kop).toMatch(/class="reader-status__later"/);
		const artikel = bron('lib/components/explore/readers/ArticleReader.svelte');
		expect(artikel).toMatch(/\{#snippet later\(\)\}[\s\S]*?billCount/);
		expect(artikel).toMatch(/\slaterPlek(=\{true\})?[\s>]/);
	});

	it('says the chain of an amended stuk in the status line, where every reader has its status', () => {
		// "Vervangt nr. 10", "Vervangen door nr. 47": words of the status line through ReaderHead,
		// not a row or a section of their own, on one reader for amendementen and moties alike.
		const lezer = bron('lib/components/explore/readers/DocumentReader.svelte');
		const status = /\{#snippet statusLine\(\)\}([\s\S]*?)\{\/snippet\}/.exec(lezer)?.[1] ?? '';
		expect(status).toMatch(/<Vervanging zinnen=\{vervanging\(doc\)\} \/>/);
		expect(lezer.match(/<Vervanging\b/g)).toHaveLength(1);
		expect(
			overtreders(
				(t) => /<Vervanging\b/.test(t),
				[plek('lib/components/explore/readers/DocumentReader.svelte')]
			)
		).toEqual([]);
		// Its numbers are BronLinks, inline in the run of words.
		const zin = bron('lib/components/parliamentary/Vervanging.svelte');
		expect(zin).toMatch(/<BronLink\b/);
		expect(zin).not.toMatch(/<(p|div|section|Sectie)\b/);
	});

	it('keeps the canvas and the lists of Bronnen out of the Verkenner’s own chunk', () => {
		// A reader's first request waits for the Verkenner's chunk: the canvas (GraphView with
		// graphology) and IndexView come as chunks of their own (213 → 145 kB gz, 10 Oct).
		const t = bron('routes/explore/+page.svelte');
		expect(t).not.toMatch(/^\s*import (GraphView|IndexView) from/m);
		expect(t).toMatch(/import\('\$lib\/components\/graph\/GraphView\.svelte'\)/);
		expect(t).toMatch(/import\('\$lib\/components\/explore\/IndexView\.svelte'\)/);
	});
});
