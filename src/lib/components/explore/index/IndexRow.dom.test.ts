import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import IndexRow from './IndexRow.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// Under the title: a line with a link of its own (an indiener) and a button of its own.
const body = createRawSnippet(() => ({
	render: () =>
		`<p class="regel">Ingediend door <a href="/leden/x">B. Madlener</a> <button type="button">Meer</button></p>`
}));

function rij() {
	const onToggle = vi.fn();
	render(IndexRow, {
		title: 'Wet betaalbare huur',
		href: '/dossiers/36496',
		onToggle,
		body
	});
	return onToggle;
}

/** A plain click, which a link inside would follow: the window stops it once it is past. */
function klik(el: Element) {
	addEventListener('click', (e) => e.preventDefault(), { once: true });
	return fireEvent.click(el);
}

describe('IndexRow', () => {
	it('opens in place with one click on the row, its title or its toggle', async () => {
		const onToggle = rij();
		await klik(screen.getByText('Ingediend door', { exact: false }));
		expect(onToggle).toHaveBeenCalledTimes(1);
		await klik(screen.getByRole('link', { name: 'Wet betaalbare huur' }));
		expect(onToggle).toHaveBeenCalledTimes(2);
		await klik(screen.getByRole('button', { name: 'Details van Wet betaalbare huur' }));
		expect(onToggle).toHaveBeenCalledTimes(3);
	});

	it('does not open on a click on a link or a button in it', async () => {
		const onToggle = rij();
		await klik(screen.getByRole('link', { name: 'B. Madlener' }));
		await klik(screen.getByRole('button', { name: 'Meer' }));
		expect(onToggle).not.toHaveBeenCalled();
	});

	it('does not open on a click that ends a text selection', async () => {
		const onToggle = rij();
		const selectie = vi
			.spyOn(window, 'getSelection')
			.mockReturnValue({ toString: () => 'betaalbare' } as Selection);
		await klik(screen.getByText('Ingediend door', { exact: false }));
		expect(onToggle).not.toHaveBeenCalled();
		selectie.mockRestore();
	});

	it('leaves a cmd-click on its title to the link', async () => {
		const onToggle = rij();
		addEventListener('click', (e) => e.preventDefault(), { once: true });
		await fireEvent.click(screen.getByRole('link', { name: 'Wet betaalbare huur' }), {
			metaKey: true
		});
		expect(onToggle).not.toHaveBeenCalled();
	});
});
