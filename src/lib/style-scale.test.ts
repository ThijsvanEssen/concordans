// The type scale and the spacing scale live in AppShell's tokens. This test holds the
// components to them: no font size in pixels, and no more off-scale spacing than there
// was when the scale was brought in (a ratchet: lower OFF_SCALE_MAX as values move).
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

// 28 September 2026, when the scale was brought in (U25); 263 after the readers, 2 October.
const OFF_SCALE_MAX = 263;

describe('the type and spacing scale', () => {
	it('gives no font size in pixels outside the tokens', () => {
		const literal = sources.flatMap(({ path, text }) =>
			[...text.matchAll(/font-size:\s*[\d.]+px/g)].map((m) => `${path}: ${m[0]}`)
		);
		// AppShell defines the tokens themselves with custom properties, not font-size.
		expect(literal).toEqual([]);
	});

	it('does not add spacing off the 4px scale', () => {
		const count = sources.reduce((n, { text }) => n + offScale(text).length, 0);
		expect(count).toBeLessThanOrEqual(OFF_SCALE_MAX);
	});
});
