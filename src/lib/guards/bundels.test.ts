// The bundels (decision 19 and 20A/20E, ~/Development/product-kompas/bundels-ux-voorstel.md):
// one name, one address, an overview that is a list and a bundel's own page that is the
// place to work, a shared bundel read as that page.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the name and the address of the bundels (decision 19)', () => {
	it('says Bundels, never Gemarkeerd; the address of before only where it moves', () => {
		expect(overtreders((t) => /\bGemarkeerd\b/.test(t))).toEqual([]);
		expect(overtreders((t) => /\/gemarkeerd\b/.test(t), [plek('lib/map/page.ts')])).toEqual([]);
	});

	it('names the menu item Bundels, without a count', () => {
		const bar = bron('lib/components/layout/TopBar.svelte');
		expect(bar.match(/>Bundels</g)).toHaveLength(2);
		expect(bar).not.toContain('nav-tel');
	});

	it('links to a bundel’s page and the overview through one place ($lib/map/page.ts)', () => {
		expect(overtreders((t) => /["'`]\/bundels\b/.test(t), [plek('lib/map/page.ts')])).toEqual([]);
	});
});
