// The serif for text, the sans for controls, three weights, and the quiet line once
// (docs/typografie.md).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, isControl, overtreders, plek, regels } from '$lib/test/bronnen';

describe('typography', () => {
	it('sets text in the serif and only controls in the sans (docs/typografie.md, 10 Oct 2026)', () => {
		expect(overtreders((t) => t.includes('var(--font-sans)'))).toEqual([]);
		// The sans only where a control is styled.
		expect(
			overtreders((t) =>
				regels(t).some((r) => r.body.includes('var(--font-ui)') && !isControl(r.selector))
			)
		).toEqual([]);
		// The serif is the page's: a paragraph, a heading, a list or a table, which no control
		// holds, has it without saying so.
		const flow = /(^|[\s>+~])(p|h[1-6]|ul|ol|li|dl|table)(?=$|[.:[\s#])/;
		expect(
			overtreders((t) =>
				regels(t).some(
					(r) =>
						/font-family:\s*var\(--font-serif\)/.test(r.body) &&
						r.selector.split(',').every((part) =>
							flow.test(
								part
									.trim()
									.split(/\s*[>+~]\s*|\s+/)
									.at(-1) ?? ''
							)
						)
				)
			)
		).toEqual([]);
		// Text in three weights: 400, 600, 800. The wordmark is a logo, not a rung.
		expect(
			overtreders(
				(t) =>
					regels(t).some(
						(r) => !isControl(r.selector) && /font-weight:\s*(?!400|600|800)\d+/.test(r.body)
					),
				[plek('lib/components/layout/Wordmark.svelte', 'a logo in its own weight')]
			)
		).toEqual([]);
	});

	it('uses tabular figures only in columns of figures', () => {
		// Tabular figures give a full stop a figure's width: "28 sep . 2026" in a sentence.
		// These files set them on a column of numbers; a new one needs the same reason.
		const columns = [
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/explore/IndexView.svelte',
			'lib/components/explore/ZaalLegenda.svelte',
			'lib/components/explore/index/IndexFacets.svelte',
			'lib/components/explore/readers/CabinetReader.svelte',
			'lib/components/explore/readers/CommitmentReader.svelte',
			'lib/components/explore/readers/DecisionReader.svelte',
			'lib/components/ui/FilterOptie.svelte',
			'lib/components/tijdlijn/Tijdlijn.svelte',
			'lib/components/graph/GraphSidebar.svelte',
			'lib/onderwerpen/Kruiswoord.svelte',
			'routes/(main)/api/+page.svelte',
			'routes/(main)/(prose)/bronnen/+page.svelte',
			'lib/components/explore/index/IndexOverzicht.svelte'
		].map((pad) => plek(pad, 'a column of figures'));
		expect(overtreders((t) => /tabular-nums/.test(t), columns)).toEqual([]);
	});

	it('heads a section of a reader with Sectie, not a grey label', () => {
		expect(overtreders((t) => /class="sec-title"|\.sec-title\b/.test(t))).toEqual([]);
	});

	it('says a state where content would be in one quiet line (.stil)', () => {
		// Round 2 of the consistency pass: "Laden…" was italic in the readers and roman on the
		// pages. A row, a caption or the nav column keeps its own smaller line.
		const eigen = /\b(stil|nav-kolom__note|onderschrift|laden|sr-only)\b/;
		const zonder = BRONNEN.flatMap(({ path, text }) =>
			[...text.matchAll(/<p class="([^"]*)"[^>]*>\s*Laden…/g)]
				.filter((m) => !eigen.test(m[1]))
				.map(() => path)
		);
		expect(zonder).toEqual([]);
		expect(
			overtreders((t) =>
				regels(t).some(
					(r) => /\.(loading|leeg|empty|explore-empty)\b/.test(r.selector) && /italic/.test(r.body)
				)
			)
		).toEqual([]);
	});

	it('defines the quiet line once, in the frame: no component styles its own .stil', () => {
		// Code-eenvoud F30: the open rows had a smaller one of their own.
		const own = (text: string) =>
			regels(text).some((r) => r.selector.split(',').some((s) => s.trim() === '.stil'));
		expect(overtreders(own).filter((p) => p.startsWith('lib/components/'))).toEqual([]);
	});

	it('reads what is hidden without taking room: no margin on .sr-only, the live region fixed (#35)', () => {
		expect(bron('lib/styles/basis.css')).toMatch(/\n\.sr-only \{[^}]*margin: 0;/);
		const layout = bron('routes/+layout.svelte');
		expect(layout).toMatch(/class="sr-only aankondiging"/);
		expect(layout).toMatch(/\.aankondiging \{\s*position: fixed;/);
	});

	it('hides text for a screen reader with the one .sr-only', () => {
		expect(
			overtreders(
				(t) => regels(t).some((r) => /clip:\s*rect\(0/.test(r.body)),
				[plek('lib/styles/basis.css', 'the one rule')]
			)
		).toEqual([]);
	});
});
