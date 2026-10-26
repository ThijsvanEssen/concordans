import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import KopActies from './KopActies.svelte';
import { bewaarItem } from '$lib/map/map';

const item = bewaarItem('articles/bwbr0005289_162', { kort: 'art. 6:162 BW' });

describe('KopActies', () => {
	it('shows Bewaar as a framed button with the choice of map joined to it', async () => {
		render(KopActies, { bewaar: item, wat: 'lid 2' });
		const knop = screen.getByRole('button', { name: 'Bewaar lid 2' });
		expect(knop.classList.contains('btn')).toBe(true);
		expect(knop.getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByRole('button', { name: /^Bewaar art\. 6:162 BW in bundel/ })).toBeTruthy();

		await fireEvent.click(knop);
		await tick();
		expect(
			screen
				.getByRole('button', { name: 'Bewaard lid 2 in Losse markeringen' })
				.getAttribute('aria-pressed')
		).toBe('true');
	});

	it('shows no Bewaar without an item to keep', () => {
		render(KopActies, {});
		expect(screen.queryByRole('button', { name: /^Bewaar/ })).toBeNull();
	});
});
