// The type scale and the spacing scale live in the tokens (lib/styles/tokens.css). This test
// holds the components to them: no font size in pixels, and no more off-scale spacing than
// there was when the scale was brought in (a ratchet: lower OFF_SCALE_MAX as values move).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|css)$/.test(name) ? [path] : [];
	});
}

const sources = files(ROOT).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

/** Off-scale pixel values in padding, margin and gap, outside calc(). */
function offScale(text: string): string[] {
	const found: string[] = [];
	const decl =
		/(?:^|[\s;{])(?:padding|margin)(?:-[a-z-]+)?\s*:\s*([^;]+);|(?:^|[\s;{])(?:row-|column-)?gap\s*:\s*([^;]+);/g;
	for (const m of text.matchAll(decl)) {
		const value = m[1] ?? m[2];
		if (value.includes('calc(')) continue;
		for (const px of value.matchAll(/(?<![\w.-])(-?[\d.]+)px\b/g)) found.push(px[1]);
	}
	return found;
}

// 28 September 2026, when the scale was brought in (U25); 263 after the readers, 178 after Bladeren, Search, Verbonden and the api page, 2 October;
// 91 after the cleanup of 10 October; 80 after the readers and the explore page; 78 on 11 October;
// 75 after the one Tijdlijn, 11 October; 71 after the Kruiswoord of ronde 6, 12 October; 69 after
// the one Tijdas, 12 October; 68 after Gemarkeerd's maps, 14 October (the rest: hairlines of 1
// to 3 px and alignments with a line of text); 67 after Verbonden's one ConfidenceDot, 14 October;
// 66 after the band Behoort bij, 14 October.
const OFF_SCALE_MAX = 66;

describe('the type and spacing scale', () => {
	it('gives no font size in pixels outside the tokens', () => {
		const literal = sources.flatMap(({ path, text }) =>
			[...text.matchAll(/font-size:\s*[\d.]+px/g)].map((m) => `${path}: ${m[0]}`)
		);
		expect(literal).toEqual([]);
	});

	it('does not add spacing off the 4px scale', () => {
		const count = sources.reduce((n, { text }) => n + offScale(text).length, 0);
		expect(count).toBeLessThanOrEqual(OFF_SCALE_MAX);
	});
});
