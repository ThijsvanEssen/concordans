// What is new since the visit before is marked one way, on Gevolgd and on a bundel alike
// (equal pages, equal experience): the mark and "nieuw sinds …" come from NewMark alone.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const NEW_MARK = 'lib/components/ui/NewMark.svelte';
/** A component's markup and style, without its script; nothing of a module. */
const markup = (t: string) =>
	/<script\b/.test(t) ? t.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '') : '';

describe('the mark of what is new', () => {
	it('is drawn by NewMark alone: its sign and its words', () => {
		expect(
			overtreders(
				(t) => /\bnieuwteken\b/.test(t) || /nieuw sinds/i.test(markup(t)),
				[plek(NEW_MARK)]
			)
		).toEqual([]);
	});

	it('marks Gevolgd and a bundel with it', () => {
		for (const path of ['lib/onderwerpen/Kruiswoord.svelte', 'lib/map/MapView.svelte'])
			expect(bron(path), path).toMatch(/<NewMark\b/);
		expect(bron('lib/map/MapGroups.svelte')).toMatch(/<NewMark\b/);
	});
});
