// The strip of the werkplek is one list per block (Thijs, 23 Oct: "versimpel dit en trek het
// recht"): Soort holds per kind its glyph, its name and "N van M" in the one column of counts,
// "Alle laden" under that count only where the kind is cut off; no block Getoond beside it, no
// load link for the whole; Relatie counts nothing (a group drawn is one line).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	join(process.cwd(), 'src/lib/components/graph/GraphSidebar.svelte'),
	'utf8'
);
const rule = (selector: string) =>
	source.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))?.[1] ??
	'';
const relatie = source.slice(source.indexOf('Relatie</h3>'), source.indexOf('{@render periode'));

describe('the strip of the werkplek', () => {
	it('has no block Getoond and no load link for the whole', () => {
		expect(source).not.toMatch(/Getoond|onAllesLaden/);
	});
	it('puts "Alle laden" under the count, in its column', () => {
		expect(rule('.laad')).toMatch(/justify-content:\s*flex-end;/);
	});
	it('counts nothing in Relatie', () => {
		expect(relatie).not.toMatch(/count=/);
	});
});
