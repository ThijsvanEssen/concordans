// The strip of the werkplek is one list per block (Thijs, 23 Oct: "versimpel dit en trek het
// recht"): Tonen holds per kind its glyph, its name and "N van M" in the one column of counts,
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
const relatie = source.slice(source.indexOf('title="Relatie"'), source.indexOf('{@render periode'));

describe('the strip of the werkplek', () => {
	it('has no block Getoond and no load link for the whole', () => {
		expect(source).not.toMatch(/Getoond|onAllesLaden/);
	});
	it('puts "Alle laden" under the count, in its column', () => {
		expect(rule('.laad')).toMatch(/justify-content:\s*flex-end;/);
	});
	it('counts the lines of each soort in Relatie, as Tonen counts its kinds', () => {
		expect(relatie).toMatch(/count=\{canvasCounts\.lines/);
	});
});

describe('an option of a filter', () => {
	const optie = readFileSync(
		join(process.cwd(), 'src/lib/components/ui/FilterOptie.svelte'),
		'utf8'
	);
	it('stands on one grid of four columns: box, mark, label, count', () => {
		const rule = optie.match(/\n\t\.optie \{([^}]*)\}/)?.[1] ?? '';
		expect(rule).toMatch(/display:\s*grid;/);
		expect(rule).toMatch(/grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto;/);
	});
	it('centres the box, the mark and the count on the first line of the label', () => {
		for (const part of ['.voor', '.aantal'])
			expect(optie).toMatch(new RegExp(`\\n\\t\\${part} \\{[^}]*height: var\\(--optie-h\\);`));
		expect(optie).toMatch(
			/\.vinkje\) \{\s*margin-top: calc\(\(var\(--optie-h\) - var\(--vink\)\) \/ 2\);/
		);
	});
});

describe('Relatie', () => {
	it('names a line by its lijnsoort in every weergave, no map of its own', () => {
		const page = readFileSync(join(process.cwd(), 'src/routes/explore/+page.svelte'), 'utf8');
		expect(source).toMatch(/LINE_KIND_LABEL\[l\]/);
		expect(source).not.toMatch(/OWN_WORDS|relationLabels/);
		expect(page).not.toMatch(/RELATION_WORDS/);
	});
});
