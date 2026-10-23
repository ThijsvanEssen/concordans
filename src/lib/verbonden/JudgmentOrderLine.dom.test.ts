// The main areas of law of a group of judgments: a choice with the counts the API gives, which
// sets the filter and, once chosen, stays to be undone.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { EMPTY_FILTER } from './filter';
import JudgmentOrderLine from './JudgmentOrderLine.svelte';

const AREAS = [
	{ area: 'Strafrecht', count: 700 },
	{ area: 'Civiel recht', count: 20 }
];

const mount = (over: Record<string, unknown> = {}) => {
	const onFilter = vi.fn();
	render(JudgmentOrderLine, {
		order: 'date',
		onOrder: () => {},
		years: [],
		areas: AREAS,
		filter: EMPTY_FILTER,
		onFilter,
		...over
	});
	return onFilter;
};

describe('Rechtsgebied of the judgments', () => {
	it('chooses an area from the counts the API gives', async () => {
		const onFilter = mount();
		await fireEvent.click(screen.getByRole('button', { name: /rechtsgebied/ }));
		await fireEvent.click(screen.getByRole('menuitemradio', { name: /Strafrecht/ }));
		expect(onFilter).toHaveBeenCalledWith({ ...EMPTY_FILTER, rechtsgebied: 'Strafrecht' });
	});

	it('names the area chosen on the control and offers all areas again', async () => {
		const onFilter = mount({ filter: { ...EMPTY_FILTER, rechtsgebied: 'Strafrecht' } });
		await fireEvent.click(screen.getByRole('button', { name: /rechtsgebied/ }));
		await fireEvent.click(screen.getByRole('menuitemradio', { name: /Alle rechtsgebieden/ }));
		expect(onFilter).toHaveBeenCalledWith({ ...EMPTY_FILTER, rechtsgebied: null });
	});

	it('shows no control where the API counts no areas', () => {
		mount({ areas: undefined, years: [{ year: 2020, count: 3 }] });
		expect(screen.queryByRole('button', { name: /rechtsgebied/ })).toBeNull();
	});
});
