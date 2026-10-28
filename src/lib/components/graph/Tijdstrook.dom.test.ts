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
		const years = [...band.parentElement!.querySelectorAll('.as span')].map((s) => s.textContent);
		// The first and the last always; a width of 0 (jsdom) fits no year between.
		expect(years[0]).toBe('2020');
		expect(years.at(-1)).toBe('2023');
		expect(band.querySelectorAll('.deel')).toHaveLength(3);
	});

	it('chooses a year on a tap, and gives every year back on a tap on the one chosen', async () => {
		const first = strook();
		await op(first.band, 150, 'pointerDown');
		await op(first.band, 150, 'pointerUp');
		expect(first.onPeriode).toHaveBeenCalledWith(2021, 2021);

		const range = strook(2021, 2021);
		await op(range.band, 150, 'pointerDown');
		await op(range.band, 150, 'pointerUp');
		expect(range.onPeriode).toHaveBeenCalledWith(null, null);
	});

	it('chooses the period a drag covers, in either direction', async () => {
		const { band, onPeriode } = strook();
		await op(band, 350, 'pointerDown');
		await op(band, 120, 'pointerMove');
		await op(band, 120, 'pointerUp');
		expect(onPeriode).toHaveBeenCalledWith(2021, 2023);
	});

	it('stacks the bronnen of a year in one bar per year, on a scale of the busiest year', () => {
		const onPeriode = vi.fn();
		const { container } = render(Tijdstrook, {
			stippen: [...stippen, { jaar: 2021.9, collection: 'documents' }],
			van: null,
			tot: null,
			onPeriode
		});
		const staven = [...container.querySelectorAll('.kolom')].map(
			(k) => k.querySelectorAll('.deel').length
		);
		expect(staven).toEqual([1, 2, 0, 1]);
		const f = [...container.querySelectorAll<HTMLElement>('.kolom')].map((k) =>
			k.style.getPropertyValue('--f')
		);
		expect(f).toEqual(['0.5', '1', '0', '0.5']);
	});

	it('has two grips as sliders, hidden at rest and shown on a period', () => {
		const rust = strook().band;
		expect(
			[...rust.querySelectorAll('[role="slider"]')].map((g) => g.hasAttribute('data-los'))
		).toEqual([true, true]);
		const { band } = strook(2021, 2022);
		const greep = [...band.querySelectorAll<HTMLElement>('[data-greep]')];
		expect(greep.map((g) => g.dataset.greep)).toEqual(['van', 'tot']);
		expect(greep.map((g) => g.hasAttribute('data-los'))).toEqual([false, false]);
		expect(greep[0].getAttribute('aria-valuenow')).toBe('2021');
		expect(greep[1].getAttribute('aria-valuenow')).toBe('2022');
	});

	it('moves one end with its grip and keeps the other', async () => {
		const { band, onPeriode } = strook(2021, 2022);
		const greep = band.querySelector<HTMLElement>('[data-greep="tot"]')!;
		await fireEvent.pointerDown(greep, { clientX: 300, pointerId: 1 });
		await op(band, 350, 'pointerMove');
		await op(band, 350, 'pointerUp');
		expect(onPeriode).toHaveBeenCalledWith(2021, 2023);
	});

	it('chooses the period with the keyboard, without dragging', async () => {
		const { band, onPeriode } = strook(2021, 2022);
		const tot = band.querySelector<HTMLElement>('[data-greep="tot"]')!;
		await fireEvent.keyDown(tot, { key: 'ArrowRight' });
		expect(onPeriode).toHaveBeenLastCalledWith(2021, 2023);
		const van = band.querySelector<HTMLElement>('[data-greep="van"]')!;
		await fireEvent.keyDown(van, { key: 'Home' });
		expect(onPeriode).toHaveBeenLastCalledWith(2020, 2022);
		await fireEvent.keyDown(van, { key: 'ArrowRight' });
		expect(onPeriode).toHaveBeenLastCalledWith(2022, 2022);
	});

	it('names the period in words, with the count per kind and what has no year', () => {
		const { container } = render(Tijdstrook, {
			stippen: [...stippen, { jaar: 2021.1, collection: 'instruments', change: 'Stb. 2021, 9' }],
			undated: 41,
			van: 2021,
			tot: null,
			fromDay: '2021-01-01',
			onPeriode: vi.fn()
		});
		expect(container.querySelector('.woorden')!.textContent).toBe('Sinds 2021');
		expect(container.querySelector('.telling')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
			'1 wet, 1 uitspraak, 1 wijziging, 41 zonder jaar'
		);
		expect(container.querySelector('[data-wijziging]')).not.toBeNull();
	});

	it('offers Alle jaren, 5 jaar, the last change and Sinds…', () => {
		const { container } = render(Tijdstrook, {
			stippen: [
				{ jaar: 2010.1, collection: 'judgments' },
				{ jaar: 2015.1, collection: 'instruments', change: 'Stb. 2015, 9' },
				{ jaar: 2023.1, collection: 'judgments' }
			],
			van: null,
			tot: null,
			onPeriode: vi.fn()
		});
		const knoppen = [...container.querySelectorAll('.snel .btn')].map((b) => b.textContent!.trim());
		expect(knoppen).toEqual(['Alle jaren', '5 jaar', 'Sinds de wijziging van 2015', 'Sinds…']);
	});

	it('dims the bronnen outside the period chosen', () => {
		const { band } = strook(2021, 2021);
		const dim = [...band.querySelectorAll('.kolom')].map((k) => k.classList.contains('is-dim'));
		expect(dim).toEqual([true, false, true, true]);
	});
});
