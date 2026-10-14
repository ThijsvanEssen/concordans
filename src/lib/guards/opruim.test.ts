// Nothing left that nothing uses: no orphan component, no prototype switch.
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders } from '$lib/test/bronnen';

describe('nothing left over', () => {
	it('keeps no component that nothing uses', () => {
		const componenten = BRONNEN.filter(
			({ path }) => path.startsWith('lib/') && path.endsWith('.svelte')
		);
		expect(
			componenten
				.filter(({ path }) => {
					const naam = `/${path.split('/').at(-1)}'`;
					return !BRONNEN.some((s) => s.path !== path && s.text.includes(naam));
				})
				.map((c) => c.path)
		).toEqual([]);
	});

	it('has no prototype switches or study folders left', () => {
		expect(
			overtreders((t) => /searchParams\.get\('(ontwerp|contrast)'\)|components\/r[0-9]\//.test(t))
		).toEqual([]);
	});
});
