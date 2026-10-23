// Every reader alike: one head, one frame, one way to load, one way to show its notes.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek, regels } from '$lib/test/bronnen';

describe('the readers', () => {
	it('searches a long text in one place, in the frame of every reader of a long text (W14)', () => {
		// "Zoek in dit stuk" is the frame's (ReaderFrame `find`): a law, an article, a bijlage, a
		// stuk and a uitspraak ask for it; none draws a search of its own over its text.
		const lang = ['Article', 'Annex', 'Document', 'Judgment', 'Instrument'];
		for (const naam of lang)
			expect(bron(`lib/components/explore/readers/${naam}Reader.svelte`), naam).toMatch(
				/<ReaderFrame\s+find\b/
			);
		expect(
			overtreders(
				(t) => /placeholder="Zoek in dit stuk"/.test(t),
				[plek('lib/components/explore/SearchInText.svelte')]
			)
		).toEqual([]);
	});

	it('sets the words of an alinea of a Kamerstuk by one component, in its reader and in a bundel (A213)', () => {
		// A question hangs its number in the margin and stands in italics, its answer under it
		// with the label of the source: ParagraphWords, from the blocks of paperBlocks.
		for (const pad of [
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/PaperParagraph.svelte'
		])
			expect(bron(pad), pad).toMatch(/<ParagraphWords\b/);
	});

	it('folds the full title of a law and of a dossier with one component (A190)', () => {
		for (const pad of [
			'lib/components/explore/WholeLawReader.svelte',
			'lib/components/explore/readers/DossierReader.svelte'
		])
			expect(bron(pad), pad).toMatch(/<FullTitle\b/);
		expect(
			overtreders((t) => />Volledige titel</.test(t), [plek('lib/components/ui/FullTitle.svelte')])
		).toEqual([]);
	});

	it('picks the peildatum of a law and of its article with one component (W14, X14)', () => {
		for (const pad of [
			'lib/components/explore/WholeLawReader.svelte',
			'lib/components/explore/readers/ArticleReader.svelte'
		])
			expect(bron(pad), pad).toMatch(/<WholeLawReaderPeildatum\b/);
		expect(
			overtreders(
				(t) => /Tekst geldend op/.test(t),
				[plek('lib/text/peildatum-label.ts', 'the words of the line, for it and the first paint')]
			)
		).toEqual([]);
	});

	it('sets footnotes by one component in every reader (Voetnoten, CitedText `noten`)', () => {
		// A judgment, a Kamerstuk and an overweging read in place (its card, Gemarkeerd) show
		// their notes alike: the marker in CitedText (in TextBlocks where a text has tables), the
		// notes in Voetnoten, one open note.
		const lezers = [
			'lib/components/explore/readers/JudgmentReader.svelte',
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/Overweging.svelte'
		];
		for (const pad of lezers) {
			const t = bron(pad);
			expect(t, pad).toMatch(/<Voetnoten\b/);
			expect(t, pad).toMatch(/<CitedText\b[^>]*\bnoten=|<TextBlocks\b[^>]*\bnotes=/);
			expect(t, pad).toMatch(/zetNootStand\(\)/);
		}
		// No other place draws a note or its marker of its own. The note of an article or a
		// bijlage is a line of its own text (#875): ArticleText sets it, its marker CitedText's.
		expect(
			overtreders(
				(t) => /class="voetnoot"|class="noot-ref/.test(t),
				[
					plek('lib/components/articles/Voetnoten.svelte'),
					plek('lib/components/articles/CitedText.svelte'),
					plek(
						'lib/components/articles/FootnoteLink.svelte',
						"the marker of an article's note, its card (besluit 29)"
					),
					plek(
						'lib/components/articles/ArticleText.svelte',
						"an article's note, a line of its text"
					)
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
			// A lid's number in the article's own layout (ArticleText); an overweging's and an
			// alinea's by PlaceNumber.
			expect(t, p).toMatch(
				p.endsWith('ArticleText.svelte') ? /class="[^"]*\bplaats-marker\b/ : /<PlaceNumber\b/
			);
		}
		// The number of a place in running text, its marker and its margin, is PlaceNumber's
		// alone (A93): no reader sets one of its own.
		expect(
			overtreders(
				(t) => /class="[^"]*\bplaats-(?:marker|nummer)\b/.test(t),
				[
					plek('lib/bron/PlaceNumber.svelte'),
					plek('lib/components/articles/ArticleText.svelte', "a lid's number, in its own layout")
				]
			)
		).toEqual([]);
		expect(bron('lib/components/articles/PlaatsMenu.svelte')).toContain('<BundleChecklist');
		// A passage of a memorie (a section: the toelichting on an article, read beside it) is
		// a place too: its heading opens the same PlaatsMenu, cited and kept as its row under
		// the article keeps it (paperSectionCite); no Citeer of its own (Thijs, 20 Oct).
		const stuk = bron('lib/components/explore/readers/DocumentReader.svelte');
		expect(stuk).toContain('paperSectionCite(');
		expect(stuk.match(/<PlaatsMenu\b/g)).toHaveLength(2);
		expect(stuk).not.toMatch(/<CiteMenu\b/);
		// An alinea is cited and kept one way, in its reader and in a bundel (paper-cite), and
		// cut from its text in one place (paperParagraphs, text/anchor.ts).
		for (const p of [
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/PaperParagraph.svelte'
		]) {
			expect(bron(p), p).toContain('paperParagraphCite(');
		}
		// The reader cuts with paperParagraphs, a bundel by the place it keeps (paperParagraphOf).
		expect(bron('lib/components/explore/readers/DocumentReader.svelte')).toContain(
			'paperParagraphs('
		);
		expect(bron('lib/bron/PaperParagraph.svelte')).toContain('paperParagraphOf(');
		expect(bron('lib/map/inhoud.ts')).toContain('paperParagraphs(');
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

	it('keeps no empty room for contents beside a reader that has none (A190)', () => {
		// Thijs, 23 Oct: a kabinet stood beside a wide empty column kept for a law's contents.
		expect(bron('routes/explore/+page.svelte')).not.toMatch(
			/\.explore-read:not\(\.explore-read--with-nav\)[^{]*\{[^}]*--reader-col-left/
		);
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
