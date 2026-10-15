// A failure swallowed into an empty state: found by one pattern, allowed only in the named
// places, whose counts only go down. A package that handles one lowers its count here.
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

const QUIET = String.raw`(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*`;
const FALLBACK = String.raw`(?:null|undefined|false|true|-?\d+|''|\[\](?:\s+as\s+[\w.<>[\]]+)?|\(\{\s*\}\)|\{${QUIET}\})`;
/** `.catch(() => null | [] | {} | …)` and a `catch {}` with nothing but a comment in it. */
const SWALLOWED = new RegExp(
	String.raw`\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*${FALLBACK}\s*\)|\bcatch\s*(?:\(\s*\w*\s*\))?\s*\{${QUIET}\}`,
	'g'
);
const swallowed = (text: string) => (text.match(SWALLOWED) ?? []).length;

/**
 * Each count is what the file has now: a package that handles one lowers it, and an entry at 0
 * comes out. A new file is never added.
 */
const PLACES: Record<string, number> = {
	// A request whose failure becomes an empty state, a 0 or "niet in de gegevens": the
	// area packages turn each into ifExists, report, ignore or load with LoadState.
	'lib/api/dossiers.ts': 1,
	'lib/api/instrument-cache.ts': 2,
	'lib/components/actueel/wetsnetwerk.ts': 2,
	'lib/components/explore/IndexView.svelte': 1,
	'lib/graph/store/expansion.ts': 1,
	'lib/map/MapRegelingen.svelte': 1,
	// A throw that is no failure: a popover already in that state, a pointer capture
	// refused, storage or a clipboard that refuses (one storage helper, F32). Each gets a
	// handler that says so.
	'lib/components/explore/index/pannable.ts': 1,
	'lib/components/ui/dicht.svelte.ts': 1,
	'lib/map/map.svelte.ts': 1,
	'lib/onderwerpen/onderwerpen.ts': 1,
	'lib/onderwerpen/strekking.ts': 1,
	'routes/(main)/onderwerpen/+page.svelte': 1
};

describe('errors swallowed', () => {
	it('finds what it guards against, and not a handled failure', () => {
		const found = [
			'get().catch(() => null)',
			'get().catch(() => [])',
			'get().catch(() => {})',
			'get().catch((e) => [] as Lid[])',
			'get().catch(() => {\n\t// stil\n})',
			'try { a(); } catch {}',
			'try { a(); } catch (e) { /* stil */ }'
		];
		for (const code of found) expect(swallowed(code), code).toBe(1);
		const handled = [
			"get().catch(ignore('leesbaar'))",
			"get().catch((e) => report('Verbonden', e))",
			'get().catch((e) => { request = null; throw e; })',
			'try { a(); } catch (e) { if (!isNotFound(e)) throw e; }'
		];
		for (const code of handled) expect(swallowed(code), code).toBe(0);
	});

	it('swallows a failure nowhere but in the named places, whose counts only go down', () => {
		const found = Object.fromEntries(
			BRONNEN.map(({ path, text }) => [path, swallowed(text)]).filter(([, n]) => n)
		);
		expect(found).toEqual(PLACES);
		// No reader swallows one: a secondary part says it failed (code-eenvoud F11).
		expect(Object.keys(found).filter((p) => p.includes('/explore/readers/'))).toEqual([]);
	});
});
