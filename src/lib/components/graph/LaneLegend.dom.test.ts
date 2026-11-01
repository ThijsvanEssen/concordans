import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { SceneLine } from '$lib/graph/scene';
import LaneLegend from './LaneLegend.svelte';

const line = (kind: SceneLine['kind'], proposed = false) => ({ kind, proposed }) as SceneLine;

describe('LaneLegend', () => {
	it('names only the lijnsoorten drawn, each once and with its sample', () => {
		const { container } = render(LaneLegend, {
			lines: [line('citation'), line('citation'), line('change', true), line('change')]
		});
		expect(screen.getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual([
			'Wijziging',
			'Voorgestelde wijziging',
			'Aanhaling'
		]);
		expect(container.querySelectorAll('svg')).toHaveLength(3);
	});
});
