// The app takes the first paint over: once its reader has the text where the paint has it,
// or at the first touch outside the paint's text, or at a key that does not read.
import { afterEach, describe, expect, it } from 'vitest';
import { readerReady, releaseFirstPaint, startTakeover } from './takeover';

const PAINT = `<div id="first-paint" class="ev"><div class="col col--reader"><div class="reader-frame"><div class="reader-body"><p>tekst</p></div></div></div></div>`;
const APP = `<div class="app"><button id="tab">Netwerk</button><div class="col col--reader"><div class="reader-frame"><div class="reader-body"></div></div></div></div>`;

function page() {
	document.body.innerHTML = PAINT + APP;
	startTakeover(document);
}

const painted = () => document.getElementById('first-paint') !== null;

afterEach(() => {
	releaseFirstPaint();
	document.body.innerHTML = '';
});

describe('the app takes the first paint over', () => {
	it('when its reader has the text where the paint has it', () => {
		page();
		expect(painted()).toBe(true);
		readerReady();
		expect(painted()).toBe(false);
	});

	it('at a touch outside the paint, not at one on its text', () => {
		page();
		document
			.querySelector('#first-paint p')!
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(painted()).toBe(true);
		document
			.getElementById('tab')!
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(painted()).toBe(false);
	});

	it('at a key that does more than read on', () => {
		page();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
		expect(painted()).toBe(true);
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
		);
		expect(painted()).toBe(false);
	});

	it('hands the reader the place the paint was read to', () => {
		page();
		const [from, to] = document.querySelectorAll<HTMLElement>('.reader-frame');
		from.scrollTop = 120;
		// jsdom lays nothing out: the step to another address lets the paint go here.
		releaseFirstPaint();
		expect(painted()).toBe(false);
		expect(to.scrollTop).toBe(120);
	});

	it('does nothing on a page without a paint', () => {
		document.body.innerHTML = APP;
		startTakeover(document);
		expect(() => readerReady()).not.toThrow();
		expect(document.querySelector('.app')).not.toBeNull();
	});
});
