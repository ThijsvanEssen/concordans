// The sheet Inhoud gives the focus back to the button Inhoud after Escape, also where a click
// did not focus that button (Safari, a tap): the page hands it over as `opener`.
import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { cleanup, render } from '@testing-library/svelte';
import TocSheet from './TocSheet.svelte';

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});

describe('TocSheet', () => {
	it('puts the focus back on the button Inhoud after Escape', async () => {
		const knop = document.createElement('button');
		knop.textContent = 'Inhoud';
		const ander = document.createElement('button');
		ander.textContent = 'Citeer';
		document.body.append(knop, ander);
		// What had the focus when the sheet opened is not the button Inhoud.
		ander.focus();
		const children = createRawSnippet(() => ({ render: () => '<a href="#x">Artikel 1</a>' }));
		const view = render(TocSheet, {
			always: true,
			onClose: () => view.unmount(),
			opener: () => knop,
			children
		});
		expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await Promise.resolve();
		expect(document.activeElement).toBe(knop);
	});
});
