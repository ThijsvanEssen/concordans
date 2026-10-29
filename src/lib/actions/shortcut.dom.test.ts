// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mayShortcut } from './keys';

const key = (extra: Partial<KeyboardEvent> = {}) =>
	({
		key: 'l',
		defaultPrevented: false,
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		target: document.body,
		...extra
	}) as KeyboardEvent;

afterEach(() => (document.body.innerHTML = ''));

describe('mayShortcut', () => {
	it('lets a plain key through', () => expect(mayShortcut(key())).toBe(true));
	it('not with a modifier, or one taken', () => {
		expect(mayShortcut(key({ ctrlKey: true }))).toBe(false);
		expect(mayShortcut(key({ altKey: true }))).toBe(false);
		expect(mayShortcut(key({ defaultPrevented: true }))).toBe(false);
	});
	it('not while the focus is in a field, a select or a textarea', () => {
		for (const tag of ['input', 'select', 'textarea']) {
			const el = document.body.appendChild(document.createElement(tag));
			el.focus();
			expect(mayShortcut(key({ target: el }))).toBe(false);
			el.remove();
		}
	});
	it('not while a Blad, dialog or menu is open', () => {
		document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
		expect(mayShortcut(key())).toBe(false);
		document.body.innerHTML = '<div role="menu"></div>';
		expect(mayShortcut(key())).toBe(false);
	});
});
