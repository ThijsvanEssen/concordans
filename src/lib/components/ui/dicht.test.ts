import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { naarAmendementen } from '$lib/components/parliamentary/naar';
import { FOLD, isOpen, subKey, zetOpen } from './dicht.svelte';
import FoldButton from './FoldButton.svelte';
import Sectie from './Sectie.svelte';
import Tijdlijn from '../tijdlijn/Tijdlijn.svelte';

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
		// Open until the reader closes it; the procedure opens it again.
		expect(sectie()).toContain('de regeling');
		zetOpen(FOLD.amendments, false);
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

	it('keeps the open state of a group of a timeline under the key it always had', () => {
		const groepen = [
			{
				id: '2024',
				titel: '2024',
				sub: '1',
				regels: [{ id: 'a', datum: '2024-05-31', teken: 'stuk' as const, zin: 'De regel' }]
			}
		];
		const tijdlijn = () => render(Tijdlijn, { props: { groepen, inklapbaar: true } }).body;
		expect(tijdlijn()).toContain('De regel');
		zetOpen(subKey('2024'), false);
		expect(tijdlijn()).not.toContain('De regel');
		expect(subKey('2024')).toBe('sub:2024');
	});
});
