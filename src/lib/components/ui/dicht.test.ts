import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { naarAmendementen } from '$lib/components/parliamentary/naar';
import { FOLD, isOpen, subKey, zetOpen } from './dicht.svelte';
import FoldButton from './FoldButton.svelte';
import Sectie from './Sectie.svelte';

const tekst = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

afterEach(() => vi.unstubAllGlobals());

describe('the keys of what opens and closes', () => {
	it('opens Amendementen from the procedure by the key its section uses', () => {
		const scrolled = vi.fn();
		vi.stubGlobal('requestAnimationFrame', (f: () => void) => f());
		vi.stubGlobal('document', {
			getElementById: (id: string) => ({ scrollIntoView: () => scrolled(id) })
		});
		const sectie = () =>
			render(Sectie, {
				props: {
					title: 'Amendementen en moties',
					sleutel: FOLD.amendments,
					id: FOLD.amendments,
					children: tekst('de regeling')
				}
			}).body;
		expect(sectie()).not.toContain('de regeling');
		naarAmendementen();
		expect(isOpen(FOLD.amendments, false)).toBe(true);
		expect(sectie()).toContain('de regeling');
		expect(scrolled).toHaveBeenCalledWith(FOLD.amendments);
	});

	it('keeps a choice in this browser, and the button says it', () => {
		const setItem = vi.fn();
		vi.stubGlobal('localStorage', { setItem });
		const knop = (open: boolean) =>
			render(FoldButton, {
				props: { sleutel: subKey('Tweede Kamer'), open, children: tekst('Tweede Kamer') }
			}).body;
		expect(isOpen(subKey('Tweede Kamer'), true)).toBe(true);
		expect(knop(true)).toContain('aria-expanded="true"');
		zetOpen(subKey('Tweede Kamer'), false);
		expect(isOpen(subKey('Tweede Kamer'), true)).toBe(false);
		expect(knop(false)).toContain('aria-expanded="false"');
		expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({ 'sub:Tweede Kamer': false });
	});
});
