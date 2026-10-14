import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverCard } from './hover-card.svelte';
import { HOVER_MS, LEAVE_MS } from './top-layer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the card of a link, a glance (the preview)', () => {
	const glance = () => new HoverCard(() => false);

	it('shows after the pointer rests on the link, and goes when it leaves', () => {
		const card = glance();
		card.pointer('mouse');
		card.enter();
		vi.advanceTimersByTime(HOVER_MS - 1);
		expect(card.open).toBe(false);
		vi.advanceTimersByTime(1);
		expect(card.open).toBe(true);
		card.leave();
		expect(card.open).toBe(false);
	});

	it('does not show for a pointer that passes', () => {
		const card = glance();
		card.pointer('mouse');
		card.enter();
		vi.advanceTimersByTime(HOVER_MS / 2);
		card.leave();
		vi.advanceTimersByTime(HOVER_MS);
		expect(card.open).toBe(false);
	});

	it('shows nothing on touch: a tap follows the link', () => {
		const card = glance();
		card.pointer('touch');
		card.enter();
		vi.advanceTimersByTime(HOVER_MS);
		expect(card.open).toBe(false);
		expect(card.tap()).toBe(false);
		expect(card.open).toBe(false);
	});

	it('shows on the focus of the keys again after a tap', () => {
		const card = glance();
		card.pointer('touch');
		card.keys();
		card.enter();
		vi.advanceTimersByTime(HOVER_MS);
		expect(card.open).toBe(true);
	});
});

describe('the card of a link, to read (an r.o.)', () => {
	const readable = () => new HoverCard(() => true);

	it('stays while the pointer crosses from the link to the card', () => {
		const card = readable();
		card.pointer('mouse');
		card.enter();
		vi.advanceTimersByTime(HOVER_MS);
		card.leave();
		vi.advanceTimersByTime(LEAVE_MS - 1);
		card.enter();
		vi.advanceTimersByTime(LEAVE_MS);
		expect(card.open).toBe(true);
		card.leave();
		vi.advanceTimersByTime(LEAVE_MS);
		expect(card.open).toBe(false);
	});

	it('shows on the first tap, and the second follows the link', () => {
		const card = readable();
		card.pointer('touch');
		card.enter();
		vi.advanceTimersByTime(HOVER_MS);
		expect(card.open).toBe(false);
		expect(card.tap()).toBe(true);
		expect(card.open).toBe(true);
		// A finger that leaves does not close it.
		card.leave();
		vi.advanceTimersByTime(LEAVE_MS);
		expect(card.open).toBe(true);
		expect(card.tap()).toBe(false);
		expect(card.open).toBe(false);
	});

	it('follows the link on a click with the mouse', () => {
		const card = readable();
		card.pointer('mouse');
		expect(card.tap()).toBe(false);
	});
});
