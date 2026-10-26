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

	it('chooses nothing on focus; Enter (a click) chooses the bron (R9)', async () => {
		const onKies = vi.fn();
		const onFocusNode = vi.fn();
		const { container } = render(CanvasNodeList, {
			nodes: [node('1'), node('2')],
			isChosen: () => false,
			onFocusNode,
			onKies
		});
		const eerste = container.querySelector<HTMLElement>('a')!;
		eerste.focus();
		expect(onFocusNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'articles/1' }));
		expect(onKies).not.toHaveBeenCalled();
		// Not followed: the link's own navigation is the second step.
		expect(await fireEvent.click(eerste)).toBe(false);
		expect(onKies).toHaveBeenCalledWith(expect.objectContaining({ id: 'articles/1' }));
	});

	it('follows the bron the arrows point at on the canvas: its tab stop, its line', async () => {
		const nodes = [node('1'), node('2')];
		const { container, rerender } = render(CanvasNodeList, {
			nodes,
			isChosen: () => false,
			onFocusNode: () => {},
			aangewezen: null
		});
		await rerender({ nodes, isChosen: () => false, onFocusNode: () => {}, aangewezen: nodes[1] });
		const links = container.querySelectorAll('a');
		expect(links[1].getAttribute('aria-current')).toBe('true');
		expect(links[1].tabIndex).toBe(0);
		expect(links[0].tabIndex).toBe(-1);
		expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe('Art. 2, Artikel');
	});
});
