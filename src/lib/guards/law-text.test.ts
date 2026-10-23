// The text of a law reads alike for every law, of the BWB and of the Staatsblad (gelijke
// pagina's): its references link in one place (K2), its contents follow the reader in one
// component (K3).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron } from '$lib/test/bronnen';

/** The files of the app whose text matches `rule`. */
const filesWith = (rule: RegExp) =>
	BRONNEN.filter(({ text }) => rule.test(text)).map((b) => b.path);

describe('the references in the text of a law (K2)', () => {
	it('are passed by every reader of a law to ArticleText', () => {
		for (const path of [
			'lib/components/explore/readers/ArticleReader.svelte',
			'lib/components/explore/WholeLawReaderArticle.svelte'
		]) {
			const t = bron(path);
			expect(t, path).toMatch(/<ArticleText\b[^>]*\breferences=/);
			expect(t, path).toMatch(/<ArticleText\b[^>]*\blaw=\{bwbId\}/);
		}
	});

	it('become links only in ArticleText', () => {
		expect(filesWith(/\breferenceSpans\(/)).toEqual([
			'lib/components/articles/ArticleText.svelte',
			'lib/text/references.ts'
		]);
	});
});

describe('the contents of a law (K3)', () => {
	it('follow the whole-law reader by lawPosition, set there only', () => {
		expect(filesWith(/lawPosition\.set\(/)).toEqual([
			'lib/components/explore/law-position.svelte.ts'
		]);
		expect(filesWith(/= followPosition\(/)).toEqual([
			'lib/components/explore/WholeLawReader.svelte'
		]);
		expect(bron('lib/components/explore/LezenNav.svelte')).toMatch(/lawPosition\.of\(/);
	});

	it('know no kind of law: no BWB id is tested for', () => {
		for (const path of [
			'lib/components/explore/LezenNav.svelte',
			'lib/components/explore/law-position.svelte.ts',
			'lib/components/explore/WholeLawReaderArticle.svelte'
		])
			expect(bron(path), path).not.toMatch(/BWBR/);
	});
});

/** Every reader of the text of an article or a bijlage. */
const articleReaders = [
	'lib/components/explore/readers/ArticleReader.svelte',
	'lib/components/explore/WholeLawReaderArticle.svelte',
	'lib/map/MapInhoud.svelte',
	'lib/components/explore/readers/AnnexReader.svelte'
];

describe('the tables in a text (A20)', () => {
	it('are passed by every reader of an article to ArticleText', () => {
		expect(filesWith(/<ArticleText\b/).toSorted()).toEqual(articleReaders.toSorted());
		for (const path of articleReaders)
			expect(bron(path), path).toMatch(/<ArticleText\b[^>]*\btables=/);
	});

	it('are laid out by TextTable only', () => {
		expect(filesWith(/\bhead_rows\b|\browsOf\(/)).toEqual([
			'lib/components/articles/TextTable.svelte',
			'lib/text/tables.ts'
		]);
		// An article's text (ArticleText) and every other text with tables (TextBlocks).
		expect(filesWith(/<TextTable\b/)).toEqual([
			'lib/components/articles/ArticleText.svelte',
			'lib/components/articles/TextBlocks.svelte'
		]);
	});
});

describe('the headings in a text (A110)', () => {
	// An article reads its tussenkoppen as a bijlage does (gelijke pagina's).
	it('are passed by every reader of an article or a bijlage to ArticleText', () => {
		for (const path of articleReaders)
			expect(bron(path), path).toMatch(/<ArticleText\b[^>]*\bheadings=/);
	});
});

describe('the footnotes in a text (#875)', () => {
	it('are passed by every reader of an article or a bijlage to ArticleText', () => {
		for (const path of articleReaders)
			expect(bron(path), path).toMatch(/<ArticleText\b[^>]*\bfootnoteMarks=/);
	});
});

describe('the footnotes of their own (#881)', () => {
	// A note that is no text of the article (`footnotes`) stands under it in every reader,
	// its links (`footnote_references`) wherever the reader has the text's references.
	it('are passed by every reader of an article or a bijlage to ArticleText', () => {
		for (const path of articleReaders) {
			const t = bron(path);
			expect(t, path).toMatch(/<ArticleText\b[^>]*\bfootnotes=/);
			if (/<ArticleText\b[^>]*\breferences=/.test(t))
				expect(t, path).toMatch(/<ArticleText\b[^>]*\bfootnoteReferences=/);
		}
	});
});

describe('the text of a bijlage (#870)', () => {
	it('reads as the text of an article: ArticleText with its tables, headings and links', () => {
		const t = bron('lib/components/explore/readers/AnnexReader.svelte');
		for (const prop of ['tables', 'headings', 'parts', 'references', 'law'])
			expect(t, prop).toMatch(new RegExp(`<ArticleText\\b[^>]*\\b${prop}=`));
	});
});

describe('the tables in a judgment and a Kamerstuk (A55)', () => {
	// Their readers and a bundel's rows read a table as an article's reader does: TextBlocks,
	// TextTable in it; none sets the text of a paragraph without its tables.
	const lezers = [
		'lib/components/explore/readers/JudgmentReader.svelte',
		'lib/components/explore/readers/DocumentReader.svelte',
		'lib/bron/Overweging.svelte',
		'lib/bron/PaperParagraph.svelte'
	];

	it('are read by TextBlocks in every reader of their text, which passes the tables', () => {
		expect(filesWith(/<TextBlocks\b/)).toEqual(lezers.toSorted());
		for (const path of lezers) {
			const blocks = bron(path).match(/<TextBlocks\b[^>]*>/g) ?? [];
			expect(blocks.length, path).toBeGreaterThan(0);
			for (const b of blocks) expect(b, path).toMatch(/\btables=/);
		}
	});

	it('come with the paragraphs of a judgment and the alineas of a Kamerstuk', () => {
		// A judgment's paragraph gives its tables to the body the reader lays out (bodyItems).
		expect(bron('lib/text/judgment-text.ts')).toMatch(/\bp\.tables\b/);
		// A Kamerstuk's alinea with a table is one block (paperBlocks), in its reader and a bundel.
		for (const path of [
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/PaperParagraph.svelte'
		])
			expect(bron(path), path).toMatch(/paperBlocks\(/);
		// Neither sets the words of a Kamerstuk's line as a judgment's without its blocks.
		// The first paint of a Kamerstuk sets them as its reader does (first-paint/paper.ts).
		expect(filesWith(/paperBlocks\(/)).toEqual([
			'lib/bron/PaperParagraph.svelte',
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/first-paint/paper.ts',
			'lib/text/anchor.ts'
		]);
	});
});

describe('the card of a footnote (besluit 29)', () => {
	// The marker of a note of an article or a bijlage is one component in every reader of their
	// text (ArticleText, CitedText in it): its card, its click and its tap alike.
	it('is shown by FootnoteLink only, from CitedText', () => {
		expect(filesWith(/<FootnoteLink\b/)).toEqual(['lib/components/articles/CitedText.svelte']);
		expect(filesWith(/\.\/FootnoteCard\.svelte/)).toEqual([
			'lib/components/articles/FootnoteLink.svelte'
		]);
		expect(filesWith(/class="noot-ref__knop"/)).toEqual([
			'lib/components/articles/CitedText.svelte',
			'lib/components/articles/FootnoteLink.svelte'
		]);
	});

	it('closes as the card of a reference does (cardCloser)', () => {
		expect(filesWith(/\bcardCloser\(/).toSorted()).toEqual(
			[
				'lib/actions/hover-card.svelte.ts',
				'lib/bron/BronLink.svelte',
				'lib/components/articles/FootnoteLink.svelte'
			].toSorted()
		);
	});
});

describe('a bijlage in Tekst (besluit 29)', () => {
	// It reads in Tekst with the contents of its law beside it, as the law and its articles; every
	// bron opens in Tekst (besluit 32, exploreMode).
	it('is readable and has the contents of its law', () => {
		const list = (path: string, name: string) =>
			bron(path).match(new RegExp(`${name}[^=]*= new Set\\(\\[([^\\]]*)\\]`))?.[1] ?? '';
		for (const c of ['articles', 'instruments', 'annexes'])
			expect(list('routes/explore/+page.svelte', 'WITH_CONTENTS'), c).toContain(`'${c}'`);
		expect(bron('lib/components/explore/LezenNav.svelte')).toMatch(/collection === 'annexes'/);
	});
});
