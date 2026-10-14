// An anchor in a text is built and read in one place.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('anchors', () => {
	it('builds and reads an anchor only in $lib/text/anchor.ts (code-eenvoud F123)', () => {
		// `rov-5.1`, `fn-35`, `artikel-658`, `deel-hoofdstuk-3`, `lid-2-onder-a`: a prefix in a
		// string, a template or a pattern, comments left out.
		const prefix = '(?:rov|fn|artikel|deel|lid|tekst|onder)-';
		const hand = new RegExp(
			[
				`['"\`]${prefix}(?:['"\`]|\\$\\{)`,
				`\\^\\(?${prefix.slice(0, -1)}(?:\\|\\w+)*\\)?-`,
				`-onder-\\$\\{`
			].join('|')
		);
		const code = (t: string) =>
			t
				.replace(/<style>[\s\S]*?<\/style>/g, '')
				.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(^|[^:])\/\/.*$/gm, '$1');
		expect(overtreders((t) => hand.test(code(t)), [plek('lib/text/anchor.ts')])).toEqual([]);
	});
});
