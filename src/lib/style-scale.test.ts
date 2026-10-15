// The type scale and the spacing scale live in the tokens (lib/styles/tokens.css). This test
// holds the components to them: no font size in pixels, and no more off-scale spacing than
// there was when the scale was brought in (a ratchet: lower OFF_SCALE_MAX as values move).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');

function files(dir: string, pattern = /\.(svelte|css)$/): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path, pattern);
		return pattern.test(name) ? [path] : [];
	});
}

const read = (path: string) => ({ path, text: readFileSync(path, 'utf8') });
const sources = files(ROOT).map(read);

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
// 66 after the band Behoort bij, 14 October; 61 after the one search row (SearchOption), 14 October;
// 58 after the dead code, 15 October.
const OFF_SCALE_MAX = 58;

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

// The phone is one width, 768 px and narrower (Thijs, 14 Oct, decision 5): `max-width: 768px`
// for the phone, `min-width: 769px` above it, in the stylesheets and in `$lib/utils/breakpoints`
// alike. Before this, 767 and 768 stood side by side, and at exactly 768 px (an upright iPad)
// the list folded to one column while "Verfijnen" stayed hidden.
const WIDTHS = [520, 560, 620, 640, 768, 769, 780, 900, 1024, 1100, 1101, 1439, 1440, 1600];

// The scripts too: a `matchMedia` names the same widths.
const scripts = files(ROOT, /(?<!\.test)\.(ts|html)$/).map(read);

// The widths of the window, not of a container (`@container` keeps its own).
const mediaWidths = [...sources, ...scripts].flatMap(({ path, text }) =>
	text
		.split('\n')
		.filter((line) => !line.includes('@container'))
		.flatMap((line) =>
			[...line.matchAll(/\((max|min)-width:\s*(\d+)px\)/g)].map((m) => ({
				path,
				bound: m[1],
				px: Number(m[2])
			}))
		)
);

describe('the breakpoints', () => {
	it('writes the phone as 768 px and narrower, everywhere', () => {
		const off = mediaWidths.filter(
			({ bound, px }) => (bound === 'max' && px === 767) || (bound === 'min' && px === 768)
		);
		expect(off.map((w) => `${w.path}: ${w.bound}-width ${w.px}px`)).toEqual([]);
	});

	it('uses no width outside the known breakpoints', () => {
		const off = mediaWidths.filter(({ px }) => !WIDTHS.includes(px));
		expect(off.map((w) => `${w.path}: ${w.bound}-width ${w.px}px`)).toEqual([]);
	});

	it('keeps the sticky facet column under the top bar', () => {
		const frame = readFileSync(join(ROOT, 'lib/styles/frame.css'), 'utf8');
		const facets = frame.match(/\.blad__facetten\s*\{[^}]*\}/)?.[0] ?? '';
		expect(facets).toMatch(/top:\s*calc\(var\(--topbar-h\)/);
	});
});
