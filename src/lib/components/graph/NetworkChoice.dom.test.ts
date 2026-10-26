// The card Weergave and legend: the choice in words when folded, the steps, the key.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import NetworkChoice from './NetworkChoice.svelte';

const base = { depth: 2, onDepth: () => {}, relations: { AMENDS: 2, EXPLAINS: 1 } };

describe('NetworkChoice', () => {
	it('names the weergave and its steps, and the soorten and lines drawn', () => {
		render(NetworkChoice, { ...base, view: 'verband' });
		expect(screen.getByRole('region', { name: 'Weergave en legenda' })).toBeTruthy();
		expect(screen.getByText('Verband, 2 stappen')).toBeTruthy();
		for (const w of ['Wet', 'Parlement', 'Personen', 'Rechtspraak'])
			expect(screen.getByText(w)).toBeTruthy();
		expect(screen.getByText('Wijziging')).toBeTruthy();
		expect(screen.getByText('Toelichting')).toBeTruthy();
		expect(screen.queryByText('Aanhaling')).toBeNull();
	});
	it('chooses the steps, one is a stap', async () => {
		const onDepth = vi.fn();
		render(NetworkChoice, { ...base, view: 'omgeving', onDepth });
		await fireEvent.click(screen.getByRole('button', { name: '3 stappen' }));
		expect(onDepth).toHaveBeenCalledWith(3);
		expect(screen.getByRole('button', { name: '1 stap' })).toBeTruthy();
	});
	it('has no steps in Keten, and says so when no bron is chosen', () => {
		const { unmount } = render(NetworkChoice, { ...base, view: 'keten' });
		expect(screen.queryByRole('button', { name: '1 stap' })).toBeNull();
		unmount();
		render(NetworkChoice, { ...base, view: 'omgeving', empty: true });
		expect(screen.getByText('Nog geen bron gekozen')).toBeTruthy();
	});
});
