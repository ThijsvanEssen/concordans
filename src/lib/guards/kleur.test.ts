// Red says no or an error; a fractie has one colour everywhere.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek, regels, type Uitzondering } from '$lib/test/bronnen';

describe('colour', () => {
	it('keeps red for "nee" and an error, never for a hover or a focus (Thijs, 10 Oct 2026)', () => {
		// "De kleur mag alleen blijven zolang het een doel dient": red says no. A hover, the
		// focus ring and a wash are ink or neutral; a TekstMenu button that has the focus back
		// after a choice too (the Legenda's Bronnen stood red at rest, Thijs, 10 Oct).
		const eigen: Uitzondering[] = [
			{ pad: 'lib/styles/tokens.css', reden: 'the tokens: --accent and --uitkomst-nee' },
			{ pad: 'lib/components/layout/Wordmark.svelte', reden: 'the § of the name' },
			{ pad: 'routes/(main)/actueel/+page.svelte', reden: 'an error' }
		];
		expect(overtreders((t) => /var\(--accent\)|--accent-soft/.test(t), eigen)).toEqual([]);
		expect(bron('lib/styles/tokens.css').match(/var\(--accent\)/g)).toHaveLength(1);
	});

	it('colours a fractie only through partijkleuren: one colour per fractie everywhere (UX #57)', () => {
		expect(
			overtreders(
				(t) => t.includes(`'/api/parties/colors'`),
				[plek('lib/components/explore/partijkleuren.svelte.ts')]
			)
		).toEqual([]);
	});

	it('draws a mark in a Keuze in the colour of its option', () => {
		// On the chosen option (ink) an ink mark vanished: the mark follows the text.
		expect(
			regels(bron('lib/components/ui/Keuze.svelte')).some(
				(r) => r.selector.includes(':global(.kind-glyph)') && /color:\s*currentColor/.test(r.body)
			)
		).toBe(true);
	});
});
