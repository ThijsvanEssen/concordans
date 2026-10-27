// The block Weergave: the steps, and whatever belongs to the weergave chosen.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import NetworkChoice from './NetworkChoice.svelte';

const base = { depth: 2, onDepth: () => {} };

describe('NetworkChoice', () => {
	it('is the block Weergave, never folded, with the steps and what belongs to the weergave', () => {
		render(NetworkChoice, {
			...base,
			view: 'verband',
			children: createRawSnippet(() => ({ render: () => '<p>Tonen hier</p>' }))
		});
		expect(screen.getByRole('region', { name: 'Weergave' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Weergave/ })).toBeNull();
		expect(screen.getByRole('button', { name: '2 stappen' })).toBeTruthy();
		expect(screen.getByText('Tonen hier')).toBeTruthy();
	});
	it('has no key of its own: no Soort and no Lijnen', () => {
		render(NetworkChoice, { ...base, view: 'verband' });
		for (const w of ['Soort', 'Lijnen']) expect(screen.queryByText(w)).toBeNull();
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
	it('says why a step is off in a line, not in a title alone (C15b)', () => {
		render(NetworkChoice, { ...base, view: 'omgeving', networkOn: true, hasSelection: false });
		expect(screen.getByRole('note').textContent).toBe('Klik een bron op het canvas.');
	});
	it('says in Verband that the steps are for the pair', () => {
		render(NetworkChoice, { ...base, view: 'verband', networkOn: true, hasSelection: false });
		expect(screen.getByRole('note').textContent).toBe('Het aantal stappen geldt voor het paar.');
	});
	it('greys out the steps beyond the cap and says the cap in their title only (R7)', () => {
		const { container } = render(NetworkChoice, {
			...base,
			view: 'omgeving',
			reach: { depth: 1, capped: true, cap: 150 } as never
		});
		expect(screen.queryByRole('note')).toBeNull();
		expect(container.textContent).not.toMatch(/Maximaal|voegt niets toe/);
		expect(container.querySelector('[title="Maximaal 150 bronnen getoond"]')).toBeTruthy();
	});
});
