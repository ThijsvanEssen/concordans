import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import Tijdstrook from './Tijdstrook.svelte';

// Four years, 2020 to 2023, on a band of 400 px: each year is 100 px wide.
const stippen = [
	{ jaar: 2020.2, collection: 'documents' },
	{ jaar: 2021.5, collection: 'judgments' },
	{ jaar: 2023.1, collection: 'instruments' }
] as const;

function strook(van: number | null = null, tot: number | null = null) {
	const onPeriode = vi.fn();
	const { container } = render(Tijdstrook, {
		stippen: [...stippen],
		van,
		tot,
		onPeriode
	});
	return { onPeriode, band: container.querySelector<HTMLElement>('.band')! };
}

const op = (band: HTMLElement, x: number, type: 'pointerDown' | 'pointerMove' | 'pointerUp') =>
	fireEvent[type](band, { clientX: x, pointerId: 1 });

beforeEach(() => {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		left: 0,
		width: 400,
		right: 400,
		top: 0,
		bottom: 20,
		height: 20,
		x: 0,
		y: 0,
		toJSON: () => ({})
	});
	HTMLElement.prototype.setPointerCapture = () => {};
});
afterEach(() => vi.restoreAllMocks());

describe('the Tijdstrook', () => {
	it('names the years from the first bron to the last', () => {
		const { band } = strook();
		const jaren = [...band.parentElement!.querySelectorAll('.as span')].map((s) => s.textContent);
		expect(jaren).toEqual(['2020', '2021', '2022', '2023']);
		expect(band.querySelectorAll('.stip')).toHaveLength(3);
	});

	it('chooses a year on a tap, and gives every year back on a tap on the one chosen', async () => {
		const eerste = strook();
		await op(eerste.band, 150, 'pointerDown');
		await op(eerste.band, 150, 'pointerUp');
		expect(eerste.onPeriode).toHaveBeenCalledWith(2021, 2021);

		const gekozen = strook(2021, 2021);
		await op(gekozen.band, 150, 'pointerDown');
		await op(gekozen.band, 150, 'pointerUp');
		expect(gekozen.onPeriode).toHaveBeenCalledWith(null, null);
	});

	it('chooses the period a drag covers, in either direction', async () => {
		const { band, onPeriode } = strook();
		await op(band, 350, 'pointerDown');
		await op(band, 120, 'pointerMove');
		await op(band, 120, 'pointerUp');
		expect(onPeriode).toHaveBeenCalledWith(2021, 2023);
	});

	it('dims the bronnen outside the period chosen', () => {
		const { band } = strook(2021, 2021);
		const dim = [...band.querySelectorAll('.stip')].map((s) => s.classList.contains('is-dim'));
		expect(dim).toEqual([true, false, true]);
	});
});
