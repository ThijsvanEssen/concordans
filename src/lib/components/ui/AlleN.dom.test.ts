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

describe('AlleN, the form volgende', () => {
	const text = (props: Record<string, unknown>) =>
		render(AlleN, { noun: 'uitspraken', volgende: true, ...props }).container.textContent;

	it('says the next page and what is still to come', () => {
		expect(text({ stap: 25, rest: 244 })).toBe('Volgende 25 uitspraken, nog 244');
	});

	it('leaves out what it does not know', () => {
		expect(text({})).toBe('Volgende uitspraken');
		expect(text({ rest: 244 })).toBe('Volgende uitspraken, nog 244');
	});

	it('names the last page by its size, without "nog"', () => {
		expect(text({ stap: 25, rest: 7 })).toBe('Volgende 7 uitspraken');
		expect(text({ stap: 25, rest: 25 })).toBe('Volgende 25 uitspraken');
	});

	it('is Laden… while the page comes, with no link', () => {
		const { container } = render(AlleN, { noun: 'uitspraken', volgende: true, laden: true });
		expect(container.textContent).toBe('Laden…');
		expect(container.querySelector('button, a')).toBeNull();
	});

	it('is Opnieuw after a failure', () => {
		expect(text({ stap: 25, rest: 244, opnieuw: true })).toBe('Opnieuw');
	});
});

describe('AlleN, folding', () => {
	it('tells a screen reader whether the list stands whole', () => {
		const { container } = render(AlleN, { aantal: 8, noun: 'besluiten', onclick: () => {} });
		expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
	});

	it('is a plain link where it leads to a page', () => {
		const { container } = render(AlleN, { aantal: 8, noun: 'besluiten', href: '/x' });
		expect(container.querySelector('a')?.hasAttribute('aria-expanded')).toBe(false);
	});
});
