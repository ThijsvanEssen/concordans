// The search: one way to ask (the session), one row (SearchOption).
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders, plek } from '$lib/test/bronnen';

const SEARCH = BRONNEN.filter(({ path }) => path.startsWith('lib/search/'));

describe('the search', () => {
	it('asks /api/search per lane in the session (live) and in the results (full) alone (code-eenvoud F92)', () => {
		expect(
			overtreders(
				(t) => /import \{[^}]*\bsearch\b[^}]*\} from '\$lib\/api\/search'/.test(t),
				[plek('lib/search/session.svelte.ts'), plek('lib/search/results.svelte.ts')],
				SEARCH
			)
		).toEqual([]);
	});

	it('draws every row of the list with SearchOption', () => {
		expect(
			overtreders((t) => /role="option"/.test(t), [plek('lib/search/SearchOption.svelte')], SEARCH)
		).toEqual([]);
	});

	it('draws the results page with ResultaatRij, one row per hit, never a second kind of row', () => {
		const page = BRONNEN.find(({ path }) => path === 'routes/(main)/zoeken/+page.svelte')!;
		expect(page.text).toContain('<ResultaatRij');
		expect(page.text).not.toMatch(/role="option"|presentHit/);
	});
});
