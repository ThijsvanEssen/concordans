import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import CanvasNodeList from './CanvasNodeList.svelte';
import type { GraphNode } from '$lib/graph/types';

const node = (key: string): GraphNode => ({
	id: `articles/${key}`,
	collection: 'articles',
	key,
	drawClass: 'article',
	label: `Art. ${key}`
});

describe('CanvasNodeList', () => {
	it('closes the card of the bron in focus with Escape, the focus staying on the bron (B6)', async () => {
		const onEscape = vi.fn(() => true);
		const { container } = render(CanvasNodeList, {
			nodes: [node('1'), node('2')],
			isChosen: () => false,
			onFocusNode: () => {},
			onEscape
		});
		const eerste = container.querySelector<HTMLElement>('a')!;
		eerste.focus();
		const toets = await fireEvent.keyDown(eerste, { key: 'Escape' });
		expect(onEscape).toHaveBeenCalledOnce();
		// Handled: no other Escape (a reader, a page) closes as well.
		expect(toets).toBe(false);
		expect(document.activeElement).toBe(eerste);
	});

	it('leaves Escape to the page where no card is open', async () => {
		const { container } = render(CanvasNodeList, {
			nodes: [node('1')],
			isChosen: () => false,
			onFocusNode: () => {},
			onEscape: () => false
		});
		const eerste = container.querySelector<HTMLElement>('a')!;
		expect(await fireEvent.keyDown(eerste, { key: 'Escape' })).toBe(true);
	});
});
