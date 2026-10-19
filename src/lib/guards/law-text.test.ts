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
