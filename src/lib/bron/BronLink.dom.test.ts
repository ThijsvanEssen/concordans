import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { HOVER_MS } from '$lib/actions/top-layer';
import { fakeApi } from '$lib/test/fakeApi';
import BronLink from './BronLink.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const tekst = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));
const voorbeeld = { kicker: 'Wet', title: 'Burgerlijk Wetboek Boek 6', date: null, lines: null };
// A judgment at an r.o.: its card is the overweging, a card to read.
const RO = { ref: 'judgments/ecli_nl_hr_2019_2006', at: 'rov-3.1' };

/** A pointer event of `type`, as a finger or a mouse gives it (jsdom has no PointerEvent). */
function pointer(el: Element, type: string, pointerType: 'mouse' | 'touch') {
	const e = new Event(type, { bubbles: type === 'pointerdown' });
	Object.defineProperty(e, 'pointerType', { value: pointerType });
	el.dispatchEvent(e);
}

/** A tap or click on `el`: whether the link is followed (nothing prevented it). jsdom does not
 *  navigate, so the window, last on the click's way, stops it once it has looked. */
function tik(el: Element): boolean {
	let gevolgd = false;
	addEventListener(
		'click',
		(e) => {
			gevolgd = !e.defaultPrevented;
			e.preventDefault();
		},
		{ once: true }
	);
	el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	return gevolgd;
}

async function wacht(ms: number) {
	await vi.advanceTimersByTimeAsync(ms);
	await tick();
}

// The cards are chunks of their own, asked when the pointer reaches the link: loaded once
// here, before the clock is faked, as a browser has them after the first.
beforeAll(async () => {
	await Promise.all([import('./PreviewCard.svelte'), import('./OverwegingKaart.svelte')]);
});

beforeEach(() => {
	vi.useFakeTimers();
	// The judgment never answers: the card to read stands with Laden….
	fakeApi({ '/api/judgments/{ecli}': () => new Promise(() => {}) });
});
afterEach(() => vi.useRealTimers());

describe('BronLink', () => {
	it('shows its card once the pointer has rested on it, and not before', async () => {
		render(BronLink, { ref: 'laws/BWBR0005289', voorbeeld, children: tekst('art. 6:162 BW') });
		const link = screen.getByRole('link');
		pointer(link, 'pointerenter', 'mouse');
		await wacht(HOVER_MS - 1);
		expect(screen.queryByRole('tooltip')).toBeNull();
		await wacht(1);
		expect(screen.getByRole('tooltip').textContent).toContain('Burgerlijk Wetboek Boek 6');
		expect(link.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
	});

	it('closes the card on Escape, the focus on the link', async () => {
		render(BronLink, { ref: 'laws/BWBR0005289', voorbeeld, children: tekst('art. 6:162 BW') });
		const link = screen.getByRole('link');
		link.focus();
		await wacht(HOVER_MS);
		expect(screen.getByRole('tooltip')).toBeTruthy();
		await fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(screen.queryByRole('tooltip')).toBeNull();
		expect(document.activeElement).toBe(link);
	});

	it('puts the focus back on the link when Escape closes a card to read with the focus in it', async () => {
		render(BronLink, { ...RO, children: tekst('r.o. 3.1') });
		const link = screen.getByRole('link', { name: 'r.o. 3.1' });
		link.focus();
		await wacht(HOVER_MS);
		expect(link.getAttribute('aria-expanded')).toBe('true');
		const verder = screen.getByRole('link', { name: /^Open de uitspraak bij/ });
		verder.focus();
		await tick();
		expect(screen.getByRole('dialog')).toBeTruthy();
		await fireEvent.keyDown(verder, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(link.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(link);
	});

	it('on touch shows the card to read on the first tap and follows the link on the second', async () => {
		render(BronLink, { ...RO, children: tekst('r.o. 3.1') });
		const link = screen.getByRole('link', { name: 'r.o. 3.1' });

		pointer(link, 'pointerdown', 'touch');
		expect(tik(link)).toBe(false);
		await tick();
		expect(screen.getByRole('dialog')).toBeTruthy();

		pointer(link, 'pointerdown', 'touch');
		expect(tik(link)).toBe(true);
		await tick();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('on touch shows no glance: a tap follows the link at once', async () => {
		render(BronLink, { ref: 'laws/BWBR0005289', voorbeeld, children: tekst('art. 6:162 BW') });
		const link = screen.getByRole('link');
		pointer(link, 'pointerdown', 'touch');
		pointer(link, 'pointerenter', 'touch');
		link.focus();
		expect(tik(link)).toBe(true);
		await wacht(HOVER_MS);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});
});
