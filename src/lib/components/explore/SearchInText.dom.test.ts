// "Zoek in dit stuk": the hits counted as the reader sees the text, stepped through with the
// buttons and Enter, and gone with Escape.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchInText from './SearchInText.svelte';

function make() {
	const root = document.createElement('div');
	root.innerHTML =
		'<p>De zorgplicht geldt.</p><p>Zorgplicht en nog eens zorgplicht.</p><p>Iets anders.</p>';
	document.body.append(root);
	Element.prototype.scrollTo ??= () => {};
	return root;
}

describe('SearchInText', () => {
	it('counts the hits and steps through them', async () => {
		const onClose = vi.fn();
		render(SearchInText, { root: make(), onClose });
		const field = screen.getByRole('searchbox', { name: 'Zoek in dit stuk' });
		await fireEvent.input(field, { target: { value: 'zorgplicht' } });
		await tick();
		expect(screen.getByRole('status').textContent).toBe('1 van 3');
		await fireEvent.click(screen.getByRole('button', { name: 'Volgende treffer' }));
		expect(screen.getByRole('status').textContent).toBe('2 van 3');
		await fireEvent.click(screen.getByRole('button', { name: 'Vorige treffer' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Vorige treffer' }));
		expect(screen.getByRole('status').textContent).toBe('3 van 3');
	});

	it('says when nothing is found, and says nothing for one letter', async () => {
		render(SearchInText, { root: make(), onClose: () => {} });
		const field = screen.getByRole('searchbox');
		await fireEvent.input(field, { target: { value: 'z' } });
		await tick();
		expect(screen.getByRole('status').textContent).toBe('');
		await fireEvent.input(field, { target: { value: 'onvindbaar' } });
		await tick();
		expect(screen.getByRole('status').textContent).toBe('Geen treffer');
	});

	it('closes on Escape', async () => {
		const onClose = vi.fn();
		render(SearchInText, { root: make(), onClose });
		await fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
		expect(onClose).toHaveBeenCalled();
	});
});
