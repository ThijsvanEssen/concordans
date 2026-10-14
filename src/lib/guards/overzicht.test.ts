// The overview of a topic: its questions in one module, two at a time by one helper, one
// rule for a file's name (code-eenvoud F89).
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const PAGE = 'routes/(main)/onderwerpen/overzicht/+page.svelte';

describe('the overview of a topic', () => {
	it('asks its counts through overview-load, not on the page', () => {
		const page = bron(PAGE);
		expect(page).not.toMatch(/'\/api\/feed\/periods'|\bgeteld\(|'\/api\/decisions'/);
		expect(page).not.toMatch(/\$effect\(/);
	});

	it('runs two requests at a time with twoAtATime alone', () => {
		expect(
			overtreders(
				(t) => /Promise\.all\(\[\s*(\w+)\(\),\s*\1\(\)\s*\]\)/.test(t),
				[plek('lib/util/two-at-a-time.ts')]
			)
		).toEqual([]);
	});

	it('makes a name fit for a file in one place (safeFileName)', () => {
		expect(
			overtreders((t) => t.includes('[\\\\/:*?"<>|'), [plek('lib/verbonden/export.ts')])
		).toEqual([]);
	});
});
