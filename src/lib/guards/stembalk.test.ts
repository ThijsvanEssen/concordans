// A vote's outcome is drawn once, in Stembalk: width by seats, a line at the majority, a
// segment per fractie, voor and tegen in the same colours everywhere (E5, besluit 33).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek } from '$lib/test/bronnen';

describe('the bar of a vote', () => {
	it('is drawn only by Stembalk: no other component sets a width from a tally or seats', () => {
		const breedteVanStem = (t: string) =>
			/<style/.test(t) &&
			/(style:(width|flex)|style="[^"]*(width|flex))[^>]*\b(tally|seats|inFavour|counts)\b/i.test(
				t.replace(/\s+/g, ' ')
			);
		expect(
			overtreders(breedteVanStem, [plek('lib/components/parliamentary/Stembalk.svelte')])
		).toEqual([]);
	});

	it('has no older bar left: not the dark and beige one, not the day split, not a share bar', () => {
		const ouder = BRONNEN.filter(
			({ path, text }) =>
				path.endsWith('.svelte') && /vote-bar|stem-mini__bar|day-split|vote-summary/.test(text)
		).map((b) => b.path);
		expect(ouder).toEqual([]);
	});

	it('is the form wherever a vote is read: the list, the stemming, the motie, the opened row', () => {
		expect(bron('lib/components/explore/index/rows/DecisionRows.svelte')).toContain('<Stembalk');
		expect(bron('lib/components/explore/readers/DecisionReader.svelte')).toContain('<Stembalk');
		expect(bron('lib/components/parliamentary/VoteLine.svelte')).toContain('<Stembalk');
		// An opened row draws it through the VoteLine of the stemming, or Stembalk where it has none.
		expect(bron('lib/components/open/RijInhoud.svelte')).toMatch(/<VoteLine[\s\S]*<Stembalk/);
	});

	it('is in Actueel too, and a stemming says its outcome as the motie does (T5 E5)', () => {
		expect(bron('lib/components/actueel/FeedDay.svelte')).toContain('<Stembalk');
		const reader = bron('lib/components/explore/readers/DecisionReader.svelte');
		expect(reader).toMatch(/<Uitkomst\s+tone=\{outcomeTone\(d\)\}/);
		expect(reader).not.toMatch(/class="uitslag"/);
		expect(bron('lib/components/parliamentary/vote-line.ts')).toMatch(/tone: outcomeTone\(d\)/);
	});

	it('colours voor and tegen with the outcome tokens, and the line at the majority in ink', () => {
		const t = bron('lib/components/parliamentary/Stembalk.svelte');
		expect(t).toMatch(/\.part--for\s*\{[^}]*var\(--uitkomst-ja\)/);
		expect(t).toMatch(/\.part--against\s*\{[^}]*var\(--uitkomst-nee\)/);
		// Red only with its word: the number of tegen carries "tegen" beside it.
		expect(t).toMatch(/<b>\{model\.counts\.against\}<\/b> tegen/);
		// Read as one sentence, with a table behind it.
		expect(t).toContain('aria-label={model.sentence}');
		expect(t).toContain('<table class="sr-only">');
	});
});
