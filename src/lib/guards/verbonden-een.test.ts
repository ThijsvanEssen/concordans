// Verbonden has one view (A208e, Thijs 23 Oct: "Alle soorten" and "Per soort" were confusing):
// the soorten, open with their first rows and "Alle N", a soort opened in place; one Filter;
// no Indeling and no second view per soort. The drawing and the list are of the same soorten.
import { describe, expect, it } from 'vitest';
import { bron } from '$lib/test/bronnen';

describe('Verbonden', () => {
	it('has one view: no Indeling, no Alle soorten, no regrouping', () => {
		const panel = bron('lib/verbonden/Verbonden.svelte');
		expect(panel).not.toMatch(/label="Indeling"|>Alle soorten<|GROUPINGS|regroup\(/);
		expect(bron('lib/verbonden/view.ts')).not.toMatch(/export function regroup|GROUPINGS/);
	});

	it('draws the soorten it lists: the drawing and the summary both read `kinds`', () => {
		const panel = bron('lib/verbonden/Verbonden.svelte');
		expect(panel).toMatch(
			/const sketchGroups = \$derived<SketchGroup\[\]>\(\s*showNetwork\s*\?\s*kinds\.map/
		);
		expect(panel).toMatch(/<KindSummary\s+\{kinds\}/);
	});
});
