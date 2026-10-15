import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import TekstMenu from './TekstMenu.svelte';

const opties = [
	{ waarde: 'nieuw', label: 'Nieuwste eerst' },
	{ waarde: 'oud', label: 'Oudste eerst' },
	{ waarde: 'relevant', label: 'Meest relevant' }
];

async function open() {
	const onKies = vi.fn();
	render(TekstMenu, { label: 'Volgorde', opties, waarde: 'oud', onSelect: onKies });
	const knop = screen.getByRole('button', { name: 'Volgorde: Oudste eerst' });
	await fireEvent.click(knop);
	await tick();
	return { knop, onKies };
}

const item = (naam: string) => screen.getByRole('menuitemradio', { name: naam });

describe('TekstMenu', () => {
	it('opens on its button with the focus on the chosen option', async () => {
		const { knop } = await open();
		expect(knop.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('menu', { name: 'Volgorde' })).toBeTruthy();
		expect(document.activeElement).toBe(item('Oudste eerst'));
	});

	it('moves between the items with the arrow keys, Home and End', async () => {
		await open();
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(item('Meest relevant'));
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(item('Nieuwste eerst'));
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
		expect(document.activeElement).toBe(item('Meest relevant'));
		await fireEvent.keyDown(document.activeElement!, { key: 'Home' });
		expect(document.activeElement).toBe(item('Nieuwste eerst'));
		await fireEvent.keyDown(document.activeElement!, { key: 'End' });
		expect(document.activeElement).toBe(item('Meest relevant'));
	});

	it('closes on Escape, with the focus back on its button', async () => {
		const { knop } = await open();
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		expect(knop.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(knop);
	});

	it('closes on a click outside, which reaches nothing under it', async () => {
		const { knop, onKies } = await open();
		const buiten = document.body.appendChild(document.createElement('button'));
		const geraakt = vi.fn();
		buiten.addEventListener('click', geraakt);
		await fireEvent.click(buiten);
		expect(screen.queryByRole('menu')).toBeNull();
		expect(knop.getAttribute('aria-expanded')).toBe('false');
		expect(geraakt).not.toHaveBeenCalled();
		expect(onKies).not.toHaveBeenCalled();
		buiten.remove();
	});

	it('chooses an option and closes', async () => {
		const { onKies } = await open();
		await fireEvent.click(item('Meest relevant'));
		expect(onKies).toHaveBeenCalledWith('relevant');
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
