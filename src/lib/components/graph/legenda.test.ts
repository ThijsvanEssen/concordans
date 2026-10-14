// The Legenda's "Getoond" rows: glyph, kind and count on one line, "Alle laden" on a line of
// its own under the count. A fourth column beside the count squeezed the kind's name into it
// (Thijs, 11 Oct, variant A).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
	join(process.cwd(), 'src/lib/components/graph/GraphSidebar.svelte'),
	'utf8'
);
const rule = (selector: string) =>
	css.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))?.[1] ?? '';

describe('the Legenda rows of Getoond', () => {
	it('have three columns, so the kind keeps its width', () => {
		const tracks = rule('.uitsnede li').match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? '';
		expect(tracks.trim().split(/\s+(?![^(]*\))/)).toHaveLength(3);
	});
	it('put "Alle laden" under the count', () => {
		expect(rule('.uitsnede__laad')).toMatch(/grid-column:\s*3;/);
	});
});
