import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { SceneUnit } from '$lib/graph/scene';
import LaneCard from './LaneCard.svelte';

const group = {
	id: 'group:a',
	shape: 'group',
	column: 'papers',
	label: '4 stukken',
	members: [],
	rows: [],
	breakdown: null
} as unknown as SceneUnit;

function open() {
	const onClose = vi.fn();
	render(LaneCard, { unit: group, nodeOf: () => undefined, onMark: () => {}, onClose });
	return onClose;
}

describe('LaneCard', () => {
	it('closes with the button Sluiten, as a Blad does', async () => {
		const onClose = open();
		await fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('closes with Escape, and its button says so', async () => {
		const onClose = open();
		expect(screen.getByRole('button', { name: 'Sluiten' }).title).toBe('Sluiten (Esc)');
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});
});
