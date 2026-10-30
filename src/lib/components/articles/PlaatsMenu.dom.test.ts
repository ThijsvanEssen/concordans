import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import PlaatsMenu from './PlaatsMenu.svelte';
import { bewaarItem } from '$lib/map/map';
import { kaart } from '$lib/map/map.svelte';

const lid = bewaarItem('articles/bwbr0005289_162', { at: 'lid-2', kort: 'art. 6:162 lid 2 BW' });

function open() {
	const anker = document.body.appendChild(document.createElement('button'));
	const onClose = vi.fn();
	render(PlaatsMenu, { anker, title: 'Lid 2', tekst: () => 'tekst', bewaar: lid, onClose });
	return onClose;
}

describe('PlaatsMenu, Bewaar in bundel…', () => {
	it('opens the bundels with their ticks and keeps the lid in the one chosen', async () => {
		kaart.nieuw('Thuiswerk', []);
		open();
		expect(screen.getByRole('menuitem', { name: 'Bewaar in Mijn markeringen' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('menuitem', { name: 'Bewaar in bundel…' }));
		await tick();
		await tick();
		const thuis = screen.getByRole('menuitemcheckbox', { name: 'Thuiswerk' });
		expect(screen.queryByRole('menuitem', { name: /^Bewaar in/ })).toBeNull();
		expect(document.activeElement?.getAttribute('role')).toBe('menuitemcheckbox');

		await fireEvent.click(thuis);
		await tick();
		expect(thuis.getAttribute('aria-checked')).toBe('true');
		expect(
			screen
				.getByRole('menuitemcheckbox', { name: 'Mijn markeringen' })
				.getAttribute('aria-checked')
		).toBe('false');
		expect(kaart.holding(lid).map((m) => m.naam)).toEqual(['Thuiswerk']);
	});
});
