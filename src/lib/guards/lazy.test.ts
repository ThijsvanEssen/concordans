// What a page needs only after a hover, a key or a choice comes in a chunk of its own: a
// static import would put it in the first load of every page that holds its caller.
import { describe, expect, it } from 'vitest';
import { bron } from '$lib/test/bronnen';

/** The modules a file imports statically (`import … from '…'`, not `import(…)`). */
const staticImports = (path: string) =>
	[...bron(path).matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gm)].map((m) => m[1]);

/** Per file, what it asks only when it is first needed. */
const LAZY: Record<string, RegExp> = {
	'lib/components/explore/KindReader.svelte': /\/readers\/\w+Reader\.svelte$/,
	'routes/explore/+page.svelte':
		/\/readers\/\w+Reader\.svelte$|VerbondenTabel\.svelte$|FilterSheet\.svelte$/,
	'lib/components/explore/readers/ArticleReader.svelte': /(Version|Article)Compare\.svelte$/,
	'lib/bron/BronLink.svelte': /OverwegingKaart\.svelte$|PreviewCard\.svelte$|\/overweging$/,
	'lib/components/layout/SearchOverlay.svelte': /\/Search\.svelte$/
};

describe('chunks of their own', () => {
	it.each(Object.entries(LAZY))('%s imports what it needs later with import()', (path, lazy) => {
		expect(staticImports(path).filter((m) => lazy.test(m))).toEqual([]);
	});
});
