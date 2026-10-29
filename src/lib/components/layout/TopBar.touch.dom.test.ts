// A device without a keyboard shows no "Ctrl K" at the search button (Thijs, 29 Oct); the keys
// themselves stay bound.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TopBar from './TopBar.svelte';

vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return { page: readable({ url: new URL('http://localhost/wetten') }) };
});
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

function media(touch: boolean) {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: touch && query === '(hover: none) and (pointer: coarse)',
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {}
	}));
}

describe('the key hint of the search button', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('stands with a pointer that hovers', () => {
		media(false);
		const { container } = render(TopBar);
		expect(container.querySelector('.kbd')?.textContent).toMatch(/K$/);
	});

	it('is gone on a device that is touch only', () => {
		media(true);
		const { container } = render(TopBar);
		expect(container.querySelector('.kbd')).toBeNull();
	});
});
