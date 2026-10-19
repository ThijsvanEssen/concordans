import { describe, expect, it } from 'vitest';
import { focusFirstNew } from './rijen';

const list = (n: number) => {
	const node = document.createElement('ul');
	node.innerHTML = Array.from(
		{ length: n },
		(_, i) => `<li><a href="#${i}" class="t">${i}</a></li>`
	).join('');
	document.body.append(node);
	return node;
};

describe('focusFirstNew', () => {
	it('puts the focus on the first row a next page added, not on the body (B2)', () => {
		const node = list(4);
		(document.activeElement as HTMLElement | null)?.blur();
		focusFirstNew(node, 'a.t', 2);
		expect(document.activeElement?.textContent).toBe('2');
		node.remove();
	});

	it('leaves the focus where the reader took it meanwhile', () => {
		const node = list(4);
		const other = document.createElement('input');
		document.body.append(other);
		other.focus();
		focusFirstNew(node, 'a.t', 2);
		expect(document.activeElement).toBe(other);
		node.remove();
		other.remove();
	});

	it('puts it on the first link or button of a row that is no control itself (Actueel, F3)', () => {
		const node = document.createElement('ol');
		node.innerHTML = Array.from(
			{ length: 3 },
			(_, i) => `<li class="regel"><span>dag</span><button type="button">${i}</button></li>`
		).join('');
		document.body.append(node);
		(document.activeElement as HTMLElement | null)?.blur();
		focusFirstNew(node, '.regel', 1);
		expect(document.activeElement?.textContent).toBe('1');
		node.remove();
	});
});
