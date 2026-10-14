// The kind of a Kamerstuk is read in $lib/text/document-kind.ts only (code-eenvoud F74): a
// motie, an amendement, a cover letter, the bill, and a kind written short or as a reader does.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('the kind of a Kamerstuk', () => {
	it('is read by the predicates of $lib/text/document-kind.ts', () => {
		const rule =
			/\/\^?\(?(?:motie\|amendement|amendement\|motie)|\/\^?(?:motie|amendement)\b(?!\w)|geleidende brief\|aanbiedingsbrief|\/\^voorstel van wet/i;
		expect(
			overtreders(
				(t) => rule.test(t),
				[
					plek('lib/text/document-kind.ts'),
					{
						pad: 'lib/graph/types.ts',
						reden: 'the kind of an activity, not of a stuk: the word stands anywhere in it',
						regel: /documentKind\)/
					}
				]
			)
		).toEqual([]);
	});
});
