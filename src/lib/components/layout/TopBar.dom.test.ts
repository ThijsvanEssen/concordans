// The links of the top bar say on hover what each holds, as the sheet of a phone does under
// its name (F3).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { SOURCES } from '$lib/nav/sources';
import TopBar from './TopBar.svelte';

vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return { page: readable({ url: new URL('http://localhost/wetten') }) };
});
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

describe('the top bar', () => {
	it('gives each source the words of the sheet of a phone as its title', () => {
		render(TopBar);
		for (const s of SOURCES)
			expect(screen.getByRole('link', { name: s.label }).getAttribute('title')).toBe(s.holds);
	});
});
