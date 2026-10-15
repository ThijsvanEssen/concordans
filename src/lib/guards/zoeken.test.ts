// The search: one way to ask (the session), one row (SearchOption).
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders, plek } from '$lib/test/bronnen';

const SEARCH = BRONNEN.filter(({ path }) => path.startsWith('lib/search/'));

describe('the search', () => {
	it('asks /api/search per lane in the session alone (code-eenvoud F92)', () => {
		expect(
			overtreders(
				(t) => /import \{[^}]*\bsearch\b[^}]*\} from '\$lib\/api\/search'/.test(t),
				[
					plek('lib/search/session.svelte.ts'),
					plek('lib/search/resolve-query.ts', 'the law of a cited article, a question of its own')
				],
				SEARCH
			)
		).toEqual([]);
	});

	it('draws every row of the list with SearchOption', () => {
		expect(
			overtreders((t) => /role="option"/.test(t), [plek('lib/search/SearchOption.svelte')], SEARCH)
		).toEqual([]);
	});
});
