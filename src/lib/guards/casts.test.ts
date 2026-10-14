// The generated types are the contract (code-eenvoud F54): no cast past them.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('the generated types as the contract (code-eenvoud F54)', () => {
	it('reads what the API gives without a cast past its types', () => {
		// `partial`, `expanded`, `next_offset`, `membership_edge_ids`, `alternatives_total`,
		// `passed`, the query of /api/paths and a Kamer are all in openapi-types.ts.
		const pastTheTypes =
			/as \{ (?:partial|expanded|ids|membership_edge_ids|next_offset|alternatives_total|passed|rejected|labels)\??:|as 'TK' \| 'EK'|as unknown as (?:BaseNode|Schema<'MemberDTO'>)|\} as object\)|collection as never|split\('\/'\)\[0\] as Collection/;
		expect(overtreders((t) => pastTheTypes.test(t))).toEqual([]);
	});

	it('reads the meta of a neighbour as the API types it, without a cast', () => {
		expect(
			overtreders(
				(t) => /meta as Record<string, unknown>/.test(t),
				[plek('lib/components/graph/hulls.ts', 'graphology does not type its attributes')]
			)
		).toEqual([]);
	});
});
