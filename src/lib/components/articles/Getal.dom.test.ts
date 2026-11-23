// The numbers of an article (`/amounts`) in its text: marked where the text still holds them,
// none where the text does not.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ArticleText from './ArticleText.svelte';
import type { Getal } from '$lib/text/getallen';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const text = '1. De vrijstelling bedraagt € 3.115 per jaar.';
const start = text.indexOf('€');
const getal = (over: Partial<Getal> = {}): Getal => ({
	kind: 'bedrag',
	unit: 'EUR',
	text: '€ 3.115',
	part: 'lid-1',
	start,
	end: start + 7,
	source: 'text',
	cell: null,
	history: [],
	...over
});

describe('the numbers in the text of an article', () => {
	it('marks a number where the text holds it', () => {
		const { getByRole } = render(ArticleText, { text, getallen: [getal()] });
		expect(getByRole('button', { name: '€ 3.115' })).toBeTruthy();
	});
	it('marks nothing where the text holds other words at that place', () => {
		const { queryByRole } = render(ArticleText, {
			text,
			getallen: [getal({ start: 0, end: 7 })]
		});
		expect(queryByRole('button', { name: '€ 3.115' })).toBeNull();
	});
	it('marks nothing without numbers', () => {
		const { container } = render(ArticleText, { text, getallen: [] });
		expect(container.querySelectorAll('.getal')).toHaveLength(0);
	});
});
