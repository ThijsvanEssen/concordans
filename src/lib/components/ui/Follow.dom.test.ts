import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Follow from './Follow.svelte';

const href = 'https://concordans.nl/atom-link';
const write = vi.fn(() => Promise.resolve());

function clipboard() {
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText: write },
		configurable: true
	});
}

afterEach(() => write.mockClear());

describe('Follow', () => {
	it('copies the Atom link at once where it has nothing else to offer', async () => {
		clipboard();
		render(Follow, { href });
		await fireEvent.click(screen.getByRole('button', { name: 'Volg' }));
		await tick();
		expect(write).toHaveBeenCalledWith(href);
		expect(screen.getByRole('button', { name: 'Gekopieerd' })).toBeTruthy();
	});

	it('opens a menu with the local way and the Atom link', async () => {
		clipboard();
		const local = createRawSnippet(() => ({
			render: () => '<button role="menuitem">Bewaar bij Gevolgd</button>'
		}));
		render(Follow, { href, local });
		await fireEvent.click(screen.getByRole('button', { name: 'Volg' }));
		expect(screen.getByRole('menuitem', { name: 'Bewaar bij Gevolgd' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Kopieer Atom-link' }));
		await tick();
		expect(write).toHaveBeenCalledWith(href);
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
