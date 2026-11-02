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
	onToggle: (kind: LineKind) => void = () => {},
	kinds: { kind: LineKind; proposed: boolean }[] = lines,
	changesDrawn: LawChange[] = changes
) {
	return render(LaneLegend, {
		kinds,
		lines,
		hidden: new Set(hidden),
		onToggle,
		changes,
		changesDrawn
	});
}

describe('LaneLegend', () => {
	it('names the lijnsoorten of the network, one switch each, a proposed change beside its own', () => {
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
		expect(container.querySelectorAll('.kind .lm')).toHaveLength(3);
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

	it('names the same whatever is switched: off keeps its words, under a heavier line it is quiet', () => {
		const kinds = [
			{ kind: 'change', proposed: true },
			{ kind: 'citation', proposed: false }
		] as const;
		const names = () => screen.getAllByRole('button').map((b) => b.textContent?.trim());
		const on = legend([line('change', true)], [], [], undefined, [...kinds]);
		expect(names()).toEqual(['Voorgestelde wijziging', 'Aanhaling']);
		expect(screen.getByText('Aanhaling').closest('.sample')?.classList.contains('stil')).toBe(true);
		on.unmount();
		legend([line('citation')], ['change'], [], undefined, [...kinds]);
		expect(names()).toEqual(['Voorgestelde wijziging', 'Aanhaling']);
		expect(screen.getByText('Aanhaling').closest('.sample')?.classList.contains('stil')).toBe(
			false
		);
	});

	it('explains the markers of the wetten, those of this network, quiet while none stands', () => {
		legend([line('change', true)], [], ['proposed'], undefined, undefined, []);
		expect(screen.getByText('Voorgesteld').classList.contains('stil')).toBe(true);
		expect(screen.queryByText('Gewijzigd')).toBeNull();
	});
});
