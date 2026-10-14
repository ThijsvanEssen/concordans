import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'NaastPosten.svelte'), 'utf8').split('<style>')[1];
const rule = (selector: string) =>
	new RegExp(`(?:^|\\n)\\t${selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

// #81: at 802 px the matrix was 498 px in 458 px, the names over each other.
describe('NaastPosten: the matrix fits its column', () => {
	it('gives each cabinet a column of its own width and scrolls within the column beyond it', () => {
		expect(rule('.matrix')).toMatch(/overflow-x:\s*auto/);
		expect(rule('.rij')).toMatch(/repeat\(var\(--kol\), minmax\(var\(--cel\), 1fr\)\)/);
		expect(rule('.rij')).toMatch(/min-width:/);
	});

	it('keeps the post in view while the cabinets scroll', () => {
		expect(css).toMatch(/\t\.post \{[^}]*position: sticky/);
	});
});
