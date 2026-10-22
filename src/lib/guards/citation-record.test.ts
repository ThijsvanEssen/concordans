// One citation record per bron (besluit 33, E6): every place that names a bron by its place
// (art. 6:162 BW, Kamerstukken II 2023/24, 36306, nr. 11, Stb. 2018, 387, HR 20 december 2019,
// ECLI:…) reads it from citationRecord, never from the forms of one kind, never built by hand.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const RECORD = 'lib/text/citation-record.ts';

/** The forms of each kind the record is built from: imported by the record alone. */
const FORMS = [
	'citeArticle',
	'citePublication',
	'kamerstukCitation',
	'kamerstukName',
	'kamerstukLabel',
	'headingCite',
	'stbCitation'
];

describe('one citation record per bron', () => {
	it('builds its forms in the record module alone', () => {
		const imports = new RegExp(`import\\s*\\{[^}]*\\b(?:${FORMS.join('|')})\\b[^}]*\\}\\s*from`);
		expect(overtreders((t) => imports.test(t), [plek(RECORD)])).toEqual([]);
	});

	it('places a Kamerstuk, a publication and an article with its law nowhere by hand', () => {
		// `Kamerstukken II ${…}`, `${dossier}, nr. ${n}`, `Stb. ${…}`, a series map, `art. ${n}
		// ${law}`, `Artikel ${n} ${law}`.
		const byHand =
			/Kamerstukken (?:I{1,2} )?\$\{|\}, nr\. \$\{|Stb\. \$\{|stb: 'Stb\.'|`art\. \$\{[^}]+\} \$\{|`Artikel \$\{[^}]+\} \$\{/;
		expect(
			overtreders(
				(t) => byHand.test(t),
				[
					plek(RECORD),
					plek('lib/text/cite.ts', 'the forms of an article and of a publication'),
					plek('lib/text/kamerstuk.ts', 'the forms of a Kamerstuk'),
					plek('lib/text/enacted-law.ts', 'the place of a law of the Staatsblad (stbCitation)')
				]
			)
		).toEqual([]);
	});

	it('heads the readers of an article, a law and a publication with the record', () => {
		for (const pad of [
			'lib/components/explore/readers/ArticleReader.svelte',
			'lib/components/explore/WholeLawReader.svelte',
			'lib/components/explore/readers/InstrumentReader.svelte',
			'lib/components/explore/readers/JudgmentReader.svelte',
			'lib/components/parliamentary/paper-cite.ts'
		])
			expect(bron(pad), pad).toMatch(/[cC]itationRecord\(/);
		// The name over a law's table of contents is its heading, from the same function.
		expect(bron('lib/components/explore/LezenNav.svelte')).toMatch(/lawCitationRecord\(/);
	});
});
