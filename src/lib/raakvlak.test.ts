// A finger's target (UX-toets 14 Oct, #60): the small text controls carry the shared target of
// lib/styles/basis.css (.raakvlak, at least 24 px high on a touch screen), and a place's number its own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8');

describe('the touch target', () => {
	it('is on every TekstLink, link or button', () => {
		const tekstLink = read('lib/components/ui/TekstLink.svelte');
		const classes = [...tekstLink.matchAll(/class="tekstlink([^"]*)"/g)].map((m) => m[1]);
		expect(classes).toHaveLength(2);
		for (const c of classes) expect(c).toContain('raakvlak');
	});

	it("is around a place's number, before it, on a touch screen", () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toContain('.plaats-marker::before');
	});

	it("is on Gemarkeerd's own small buttons", () => {
		const groups = read('lib/map/MapGroups.svelte');
		expect(groups).toMatch(/class="notitie-knop/);
		for (const m of groups.matchAll(/class="(notitie-knop[^"]*)"/g))
			expect(m[1]).toContain('raakvlak');
		expect(read('lib/map/MapView.svelte')).toContain('class="wis raakvlak"');
	});
});
