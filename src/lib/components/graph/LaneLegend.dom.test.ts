import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { LineKind } from '$lib/graph/line-kind';
import type { LawChange, Scene, SceneLine } from '$lib/graph/scene';
import { SHOW_ALL } from '$lib/graph/visibility';
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
	const units = (of: LawChange[]) => of.map((change) => ({ change }));
	return render(LaneLegend, {
		whole: { kinds, units: units(changes) } as unknown as Scene,
		scene: { lines, units: units(changesDrawn) } as unknown as Scene,
		visibility: { ...SHOW_ALL, hiddenLines: new Set(hidden) },
		onToggleLine: onToggle
	});
}
/** The legend itself, not the unseen room it stands in. */
const shown = () => within(screen.getByRole('list', { name: 'Lijnsoorten' }));

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
		expect(container.querySelectorAll('.kinds:not(.room) .kind .lm')).toHaveLength(3);
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
		expect(shown().getByText('Aanhaling').closest('.sample')?.classList.contains('faint')).toBe(
			true
		);
		on.unmount();
		legend([line('citation')], ['change'], [], undefined, [...kinds]);
		expect(names()).toEqual(['Voorgestelde wijziging', 'Aanhaling']);
		expect(shown().getByText('Aanhaling').closest('.sample')?.classList.contains('faint')).toBe(
			false
		);
	});

	it('explains the markers of the wetten, those of this network, quiet while none stands', () => {
		legend([line('change', true)], [], ['proposed'], undefined, undefined, []);
		expect(shown().getByText('Voorgesteld').classList.contains('faint')).toBe(true);
		expect(shown().queryByText('Gewijzigd')).toBeNull();
	});

	it('stands in the room of every lijnsoort, so what comes in later moves nothing under it', () => {
		const { container } = legend([line('citation')]);
		const room = container.querySelector('.kinds.room');
		expect(room?.getAttribute('aria-hidden')).toBe('true');
		expect(room?.querySelectorAll('.kind')).toHaveLength(8);
		expect(room?.textContent).toContain('Voorgestelde wijziging');
		expect(room?.textContent).toContain('Gewijzigd');
	});
});
