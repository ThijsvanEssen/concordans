// A reader's page does not carry the Netwerk's logic (B178): the page asks it from the chunk
// netwerk-logic, so none of these modules is a static import of the page or of the handle.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const NETWERK_ONLY = [
	'$lib/network/chain',
	'$lib/network/lineage',
	'$lib/network/pairs',
	'$lib/network/linkchains',
	'$lib/network/shared',
	'./netwerk-compose.svelte'
];
const staticImports = (file: string) =>
	[
		...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(
			/^\s*import\s(?!type\b)[^;]*?from '([^']+)'/gms
		)
	].map((m) => m[1]);

describe('the Verkenner page and the Netwerk logic', () => {
	it.each(['./+page.svelte', './composer-handle.svelte.ts'])(
		'%s imports none of the Netwerk-only modules statically',
		(file) => {
			expect(staticImports(file).filter((m) => NETWERK_ONLY.includes(m))).toEqual([]);
		}
	);
	it('the chunk holds them', () => {
		const text = readFileSync(new URL('./netwerk-logic.ts', import.meta.url), 'utf8');
		for (const m of NETWERK_ONLY) expect(text).toContain(`'${m}'`);
	});
});
