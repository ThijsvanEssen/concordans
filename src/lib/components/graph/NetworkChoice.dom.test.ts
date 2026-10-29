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
	it('has no steps in Keten', () => {
		render(NetworkChoice, { ...base, view: 'keten' });
		expect(screen.queryByRole('button', { name: '1 stap' })).toBeNull();
	});
	it('offers Alleen gekozen with a netwerk only, before the steps', () => {
		const { unmount } = render(NetworkChoice, { ...base, view: 'omgeving' });
		expect(screen.queryByRole('button', { name: 'Alleen gekozen' })).toBeNull();
		unmount();
		render(NetworkChoice, { ...base, view: 'omgeving', withNetwerk: true });
		const buttons = screen.getAllByRole('button').map((b) => b.textContent);
		expect(buttons).toEqual(['Alleen gekozen', '1 stap', '2 stappen', '3 stappen']);
	});
	it('marks the step shown, with a netwerk too', () => {
		render(NetworkChoice, { ...base, view: 'omgeving', withNetwerk: true, depth: 0 });
		expect(
			screen.getByRole('button', { name: 'Alleen gekozen' }).getAttribute('aria-pressed')
		).toBe('true');
	});
	it('greys out the steps beyond the cap and says why in a line under the buttons', () => {
		const { container } = render(NetworkChoice, {
			...base,
			view: 'omgeving',
			depth: 2,
			reach: { depth: 2, capped: true, cap: 150 } as never
		});
		expect(screen.getByRole('note').textContent).toBe('Maximaal 150 bronnen getoond.');
		expect(container.querySelector('[title="Maximaal 150 bronnen getoond."]')).toBeTruthy();
		expect((screen.getByRole('button', { name: '3 stappen' }) as HTMLButtonElement).disabled).toBe(
			true
		);
		expect((screen.getByRole('button', { name: '2 stappen' }) as HTMLButtonElement).disabled).toBe(
			false
		);
	});
	it('keeps the line away at one step, where the cap is no reason to see', () => {
		render(NetworkChoice, {
			...base,
			view: 'omgeving',
			depth: 1,
			reach: { depth: 1, capped: true, cap: 150 } as never
		});
		expect(screen.queryByRole('note')).toBeNull();
	});
	it('says nothing when the steps are free', () => {
		render(NetworkChoice, { ...base, view: 'omgeving', withNetwerk: true });
		expect(screen.queryByRole('note')).toBeNull();
	});
});
