import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { LineKind } from '$lib/graph/line-kind';
import type { LawChange, SceneLine } from '$lib/graph/scene';
import LaneLegend from './LaneLegend.svelte';

const line = (kind: SceneLine['kind'], proposed = false) => ({ kind, proposed }) as SceneLine;

function legend(
	lines: SceneLine[],
	hidden: LineKind[] = [],
	changes: LawChange[] = [],
	onToggle: (kind: LineKind) => void = () => {}
) {
	return render(LaneLegend, { lines, hidden: new Set(hidden), onToggle, changes });
}

describe('LaneLegend', () => {
	it('names the lijnsoorten drawn, one switch each, a proposed change beside its own', () => {
		const { container } = legend([
			line('citation'),
			line('citation'),
			line('change', true),
			line('change')
		]);
		expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
			'Wijziging Voorgestelde wijziging',
			'Aanhaling'
		]);
		expect(container.querySelectorAll('.kind svg')).toHaveLength(3);
	});

	it('switches a lijnsoort with a click, and says whether it is on', async () => {
		const onToggle = vi.fn();
		legend([line('citation')], [], [], onToggle);
		const button = screen.getByRole('button', { name: 'Aanhaling' });
		expect(button.getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(button);
		expect(onToggle).toHaveBeenCalledWith('citation');
	});

	it('keeps a lijnsoort switched off, to switch it on again', () => {
		legend([], ['citation']);
		const button = screen.getByRole('button', { name: 'Aanhaling' });
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	it('explains the markers of the wetten, only those that stand', () => {
		legend([line('change', true)], [], ['proposed']);
		expect(screen.getByText('Voorgesteld')).toBeTruthy();
		expect(screen.queryByText('Gewijzigd')).toBeNull();
	});

	it('says why heads and markers are gone with Wijziging off', () => {
		legend([], ['change']);
		expect(screen.getByText(/geen kopjes en markers/)).toBeTruthy();
	});
});
