import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import AlleN from './AlleN.svelte';

afterEach(cleanup);

describe('AlleN', () => {
	it('counts what is more than one: "Alle 8 besluiten"', () => {
		const { container } = render(AlleN, { aantal: 8, noun: 'besluiten' });
		expect(container.textContent).toBe('Alle 8 besluiten');
	});

	it('is no link for one item, which is already on show (E9 D)', () => {
		const { container } = render(AlleN, { aantal: 1, noun: 'besluiten' });
		expect(container.textContent).toBe('');
	});

	it('still folds an open list of one', () => {
		const { container } = render(AlleN, { aantal: 1, noun: 'besluiten', open: true });
		expect(container.textContent).toBe('Minder');
	});
});
