import { describe, expect, it } from 'vitest';
import { hasModifier, isEscape, isTyping } from './keys';

const key = (over: Partial<Parameters<typeof isEscape>[0]> = {}) => ({
	key: 'Escape',
	defaultPrevented: false,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	target: { closest: () => null } as unknown as EventTarget,
	...over
});

describe('isEscape', () => {
	it('takes a plain Escape', () => expect(isEscape(key())).toBe(true));
	it('leaves an Escape a menu took, one with a modifier, and other keys', () => {
		expect(isEscape(key({ defaultPrevented: true }))).toBe(false);
		expect(isEscape(key({ metaKey: true }))).toBe(false);
		expect(isEscape(key({ key: 'Enter' }))).toBe(false);
	});
	it('leaves an Escape typed in a field', () => {
		const input = {
			closest: (s: string) => (s.includes('input') ? {} : null)
		} as unknown as EventTarget;
		expect(isEscape(key({ target: input }))).toBe(false);
	});
});

describe('isTyping', () => {
	const at = (typing: boolean) =>
		({
			closest: (s: string) => (typing && s.includes('textarea') ? {} : null)
		}) as unknown as EventTarget;
	it('tells a field from the page', () => {
		expect(isTyping(at(true))).toBe(true);
		expect(isTyping(at(false))).toBe(false);
		expect(isTyping(null)).toBe(false);
	});
});

describe('hasModifier', () => {
	it('sees each of the four modifiers', () => {
		expect(hasModifier(key())).toBe(false);
		for (const m of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const)
			expect(hasModifier(key({ [m]: true }))).toBe(true);
	});
});
