import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { HOVER_MS } from '$lib/actions/top-layer';
import { NOTE_JUMP } from '$lib/text/voetnoten.svelte';
import FootnoteLink from './FootnoteLink.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const marker = {
	id: 'fnref-1',
	label: '1',
	at: 0,
	href: '#fn-1',
	note: {
		id: 'fn-1',
		label: '1',
		text: 'Richtlijn (EU) 2019/944 van het Europees Parlement',
		citations: []
	}
};

/** A pointer event of `type`, as a finger or a mouse gives it (jsdom has no PointerEvent). */
function pointer(el: Element, type: string, pointerType: 'mouse' | 'touch') {
	const e = new Event(type, { bubbles: type === 'pointerdown' });
	Object.defineProperty(e, 'pointerType', { value: pointerType });
	el.dispatchEvent(e);
}

/** A tap or click on `el`: whether the browser would follow the link. */
function tap(el: Element): boolean {
	let followed = false;
	addEventListener(
		'click',
		(e) => {
			followed = !e.defaultPrevented;
			e.preventDefault();
		},
		{ once: true }
	);
	el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	return followed;
}

async function wait(ms: number) {
	await vi.advanceTimersByTimeAsync(ms);
	await tick();
}

beforeAll(async () => {
	await import('./FootnoteCard.svelte');
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function show() {
	const jump = vi.fn();
	render(FootnoteLink, { props: { marker }, context: new Map([[NOTE_JUMP, jump]]) });
	return { jump, link: screen.getByRole('link', { name: 'Voetnoot 1' }) };
}

describe('FootnoteLink', () => {
	it('shows the note in a card once the pointer has rested on its marker', async () => {
		const { link } = show();
		pointer(link, 'pointerenter', 'mouse');
		await wait(HOVER_MS - 1);
		expect(screen.queryByRole('dialog')).toBeNull();
		await wait(1);
		expect(screen.getByRole('dialog', { name: 'Voetnoot 1' }).textContent).toContain(
			'Richtlijn (EU) 2019/944'
		);
		expect(link.getAttribute('aria-expanded')).toBe('true');
	});

	it('goes to the note in place on a click, the card closed', async () => {
		const { link, jump } = show();
		link.focus();
		await wait(HOVER_MS);
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(tap(link)).toBe(false);
		expect(jump).toHaveBeenCalledWith('fn-1');
		await tick();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('on touch shows the card on the first tap and goes to the note on the second', async () => {
		const { link, jump } = show();
		pointer(link, 'pointerdown', 'touch');
		expect(tap(link)).toBe(false);
		await tick();
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(jump).not.toHaveBeenCalled();

		pointer(link, 'pointerdown', 'touch');
		tap(link);
		expect(jump).toHaveBeenCalledWith('fn-1');
		await tick();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('goes to the note from its card, and Escape closes it', async () => {
		const { link, jump } = show();
		link.focus();
		await wait(HOVER_MS);
		await fireEvent.click(screen.getByRole('link', { name: 'Naar de voetnoot' }));
		expect(jump).toHaveBeenCalledWith('fn-1');
		expect(screen.queryByRole('dialog')).toBeNull();

		link.blur();
		link.focus();
		await wait(HOVER_MS);
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
	});
});
