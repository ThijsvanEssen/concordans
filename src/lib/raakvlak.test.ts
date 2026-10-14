// A finger's target (UX-toets 14 Oct, #60): the small text controls carry the shared target of
// AppShell (.raakvlak, at least 24 px high on a touch screen), and a place's number its own.
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
		const shell = read('lib/components/layout/AppShell.svelte');
		const coarse = shell.slice(shell.indexOf('@media (pointer: coarse)'));
		expect(coarse).toContain(':global(.plaats-marker::before)');
	});

	it("is on Gemarkeerd's own small buttons", () => {
		const page = read('routes/(main)/gemarkeerd/+page.svelte');
		for (const m of page.matchAll(/class="(notitie-knop[^"]*)"/g))
			expect(m[1]).toContain('raakvlak');
		expect(page).toContain('buttonClass="wis raakvlak"');
	});
});
