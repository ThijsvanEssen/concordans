import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Periode from './Periode.svelte';

const VERDELING = [
	{ jaar: 1995, aantal: 5 },
	{ jaar: 2010, aantal: 20 },
	{ jaar: 2026, aantal: 40 }
];

beforeEach(() => {
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener() {},
		removeEventListener() {}
	}));
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('Periode', () => {
	it('is one button with the period in words and Wijzig', () => {
		render(Periode, { from: '2020-01-01', to: '', onChange: () => {} });
		const knop = screen.getByRole('button', { name: 'Sinds 2020 Wijzig' });
		expect(knop.getAttribute('aria-haspopup')).toBe('dialog');
		expect(knop.getAttribute('aria-expanded')).toBe('false');
	});

	it('opens a dialog and applies the typed year as 1 January', async () => {
		const onChange = vi.fn();
		render(Periode, { from: '', to: '', onChange });
		await fireEvent.click(screen.getByRole('button', { name: 'Alle jaren Wijzig' }));
		expect(screen.getByRole('dialog', { name: 'Periode' })).toBeTruthy();
		const van = screen.getByLabelText('van');
		await fireEvent.input(van, { target: { value: '2020' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Toepassen' }));
		expect(onChange).toHaveBeenCalledWith('2020-01-01', '');
	});

	it('shows one error line and does not apply a date that does not exist', async () => {
		const onChange = vi.fn();
		render(Periode, { from: '', to: '', onChange });
		await fireEvent.click(screen.getByRole('button', { name: /Wijzig/ }));
		const van = screen.getByLabelText('van');
		await fireEvent.input(van, { target: { value: '31-2-2024' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Toepassen' }));
		expect(onChange).not.toHaveBeenCalled();
		expect(van.getAttribute('aria-invalid')).toBe('true');
		const regel = document.getElementById(van.getAttribute('aria-describedby')!);
		expect(regel?.textContent).toContain('31 februari bestaat niet.');
	});

	it('says Tot ligt voor van', async () => {
		render(Periode, { from: '', to: '', onChange: () => {} });
		await fireEvent.click(screen.getByRole('button', { name: /Wijzig/ }));
		await fireEvent.input(screen.getByLabelText('van'), { target: { value: '2020' } });
		await fireEvent.input(screen.getByLabelText('tot'), { target: { value: '2010' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Toepassen' }));
		expect(screen.getByText('Tot ligt voor van.')).toBeTruthy();
	});

	it('closes on Escape without applying', async () => {
		const onChange = vi.fn();
		render(Periode, { from: '', to: '', onChange });
		const knop = screen.getByRole('button', { name: /Wijzig/ });
		await fireEvent.click(knop);
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('leaves out bars, handles and the count without a verdeling', async () => {
		render(Periode, { from: '', to: '', onChange: () => {} });
		await fireEvent.click(screen.getByRole('button', { name: /Wijzig/ }));
		expect(screen.queryAllByRole('slider')).toHaveLength(0);
		expect(screen.queryByText(/in de periode/)).toBeNull();
	});

	it('shows the distribution with two sliders and the count in the period', async () => {
		render(Periode, {
			from: '2010-01-01',
			to: '',
			onChange: () => {},
			verdeling: VERDELING,
			telt: 'Uitspraken'
		});
		await fireEvent.click(screen.getByRole('button', { name: /Wijzig/ }));
		expect(screen.getByText('Uitspraken per jaar')).toBeTruthy();
		expect(screen.getByText('60 in de periode')).toBeTruthy();
		const tot = screen.getByRole('slider', { name: 'Tot' });
		expect(tot.getAttribute('aria-valuetext')).toBe('nu');
		const van = screen.getByRole('slider', { name: 'Van' });
		await fireEvent.keyDown(van, { key: 'PageUp' });
		expect(van.getAttribute('aria-valuenow')).toBe('2020');
		expect(screen.getByText('40 in de periode')).toBeTruthy();
	});
});
