// The one sheet (Design System, Principe 6): every dialog with a scrim stands in ui/Blad.svelte.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('the Blad', () => {
	it('has no dialog of its own with a scrim or a scroll lock outside ui/Blad.svelte', () => {
		// A dialog with its own markup, close button, scrim and lock once had five forms. Left out:
		// the Zoekdialoog (its own, over the whole site) and the floating cards (no scrim, no lock).
		const dialoog = (t: string) =>
			/role="dialog"|<dialog\b/.test(t) && /--scherm|scrim|scrollLock|lockScroll|showModal/.test(t);
		expect(
			overtreders(dialoog, [
				plek('lib/components/ui/Blad.svelte'),
				plek('lib/components/layout/SearchOverlay.svelte', 'the Zoekdialoog, not a sheet')
			])
		).toEqual([]);
	});

	it('locks the page behind a sheet only in Blad and the helper', () => {
		expect(
			overtreders(
				(t) => /\b(lockScroll|scrollLock)\b/.test(t),
				[plek('lib/components/ui/Blad.svelte'), plek('lib/actions/scroll-lock.ts')]
			)
		).toEqual([]);
	});
});
