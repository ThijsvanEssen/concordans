// Words selected with a finger (A92): their menu opens once the finger has let go, and the
// selection is set again after it opens (iOS stops drawing it once the menu holds the focus).
// That second selection opens no second menu, however the browser gives its nodes back.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLACE, selection, type TextSelection } from './selection';

const finger = (type: 'touchstart' | 'touchend') =>
	document.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { touches: [] }));
const select = (r: Range) => {
	getSelection()!.removeAllRanges();
	getSelection()!.addRange(r);
	document.dispatchEvent(new Event('selectionchange'));
};

afterEach(() => {
	getSelection()?.removeAllRanges();
	document.body.innerHTML = '';
	vi.useRealTimers();
});

describe('words selected with a finger', () => {
	it('are set again once their menu opens, and open no second menu', async () => {
		vi.useFakeTimers();
		// One word in two text nodes: a selection of it by its text or by the element.
		const root = document.createElement('div');
		const lid = document.createElement('p');
		lid.setAttribute(PLACE, 'lid-2');
		lid.append('onge', 'schreven');
		root.append(lid);
		document.body.append(root);
		const opened: TextSelection[] = [];
		const action = selection(root, { open: (s) => opened.push(s) });

		const byText = document.createRange();
		byText.setStart(lid.firstChild!, 0);
		byText.setEnd(lid.lastChild!, 8);
		finger('touchstart');
		select(byText);
		finger('touchend');
		await vi.advanceTimersByTimeAsync(400);
		expect(opened.map((s) => s.text)).toEqual(['ongeschreven']);

		const set = vi.spyOn(Selection.prototype, 'addRange');
		await vi.advanceTimersByTimeAsync(150);
		expect(set).toHaveBeenCalledOnce();

		const byElement = document.createRange();
		byElement.setStart(lid, 0);
		byElement.setEnd(lid, 2);
		select(byElement);
		await vi.advanceTimersByTimeAsync(2000);
		expect(opened).toHaveLength(1);
		set.mockRestore();
		action?.destroy?.();
	});
});
