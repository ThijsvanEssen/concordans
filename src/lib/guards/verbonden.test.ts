// Verbonden alike in its panel, its table and the card of a verbinding, its words and figures
// said once (code-eenvoud F72, F73).
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const PANEL = 'lib/verbonden/Verbonden.svelte';
const TABLE = 'lib/verbonden/VerbondenTabel.svelte';
const CARD = 'lib/verbonden/VerbindingCard.svelte';

describe('Verbonden alike in panel, table and card (code-eenvoud F72, F73)', () => {
	it('says a failed load of the verbindingen with LoadState in the panel and the table (F72)', () => {
		expect([PANEL, TABLE].filter((p) => !/<LoadState\b/.test(bron(p)))).toEqual([]);
		expect(overtreders((t) => /verbindingen konden niet worden geladen/.test(t))).toEqual([]);
	});

	it('marks the betrouwbaarheid with ConfidenceDot in the table and the card (F72)', () => {
		expect([TABLE, CARD].filter((p) => !/<ConfidenceDot\b/.test(bron(p)))).toEqual([]);
		expect(
			overtreders((t) => /class="conf\b/.test(t), [plek('lib/verbonden/ConfidenceDot.svelte')])
		).toEqual([]);
	});

	it('sets a proposed change apart by one class, .is-proposed in basis.css (F72)', () => {
		expect(
			overtreders(
				(t) => /is-proposed\s*\{|row__part--proposed/.test(t),
				[plek('lib/styles/basis.css')]
			)
		).toEqual([]);
	});

	it('holds the place of rows still coming with PendingRows (F72)', () => {
		// A group still to come (PendingGroup), and a group whose loader is under way.
		const pending = [PANEL, 'lib/verbonden/PendingGroup.svelte'].map(
			(p) => bron(p).match(/<PendingRows\b/g)?.length ?? 0
		);
		expect(pending).toEqual([1, 1]);
		// The blank rows and their heights are its own, in no other place.
		expect(overtreders((t) => /rows--wacht|row--wacht|wacht-regel/.test(t))).toEqual([]);
	});

	it('grades the betrouwbaarheid by the thresholds of confidenceWord (F72)', () => {
		const figure = /[<>]=?\s*0\.[69]\b/;
		expect(
			overtreders((t) => figure.test(t)).filter((p) => p.startsWith('lib/verbonden/'))
		).toEqual([]);
	});

	it('lists the changes of the law only in $lib/vocabulary (F73)', () => {
		// The three a bill proposes, or a change by the name the API gives it (`amends`).
		const list =
			/['"]AMENDS['"],\s*['"]INTRODUCES['"],\s*['"]REPEALS['"]|\bamends:\s*['"]AMENDS['"]/;
		expect(overtreders((t) => list.test(t), [plek('lib/vocabulary.ts')])).toEqual([]);
	});
});
