// Every cut of a list in the netwerk and in Verbonden says how many of how many and opens the
// rest (Thijs, 23 Oct): "en 3 andere" as plain text, a list sliced without a word, is a gap
// the reader cannot cross. The words "andere" stand only inside the control that opens them.
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

/** The netwerk (Omgeving, Verband, Keten, the strip) and Verbonden with what it reads. */
const SCOPE =
	/^(lib\/(network|selection|verbonden|components\/graph)\/|routes\/explore\/\+page\.svelte$|lib\/text\/delegaties\.ts$)/;

/** "en 3 andere", "en ${n} andere", and the counts that make them. */
const CUT = /\ben (\$?\{[^}]+\}|\d+) andere\b|'ander', 'andere'|one: 'andere'/;

describe('a cut list in the netwerk and in Verbonden', () => {
	it('says "andere" only in the control that opens them', () => {
		const found: string[] = [];
		for (const { path, text } of BRONNEN) {
			if (!SCOPE.test(path) || path.endsWith('.test.ts')) continue;
			text.split('\n').forEach((line, i) => {
				if (!CUT.test(line)) return;
				if (/^\s*(\/\/|\*|\/\*\*|<!--)/.test(line)) return;
				const around = text
					.split('\n')
					.slice(Math.max(0, i - 3), i + 1)
					.join('\n');
				if (/<TekstLink|<button|role="button"/.test(around)) return;
				found.push(`${path}:${i + 1}: ${line.trim()}`);
			});
		}
		expect(found).toEqual([]);
	});
});
