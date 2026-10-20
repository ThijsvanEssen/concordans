// A click on a place's text opens its menu at its marker, which takes the focus: Escape gives
// it back there, as after a click on the marker (UX-toets A32 #8).
import { describe, expect, it } from 'vitest';
import { placeMarker } from './PlaatsMenu.svelte';

describe('placeMarker', () => {
	it('finds the place’s own marker, not a nested place’s, and gives it the focus', () => {
		document.body.innerHTML = `
			<div class="place" id="outer">
				<button class="plaats-marker" id="own">4</button>
				<p id="text">tekst</p>
				<div class="place"><button class="plaats-marker" id="inner">a</button></div>
			</div>`;
		const text = document.getElementById('text')!;
		let marker: HTMLElement | null = null;
		text.addEventListener('click', (e) => (marker = placeMarker(e, '.place')));
		text.click();
		expect(marker!.id).toBe('own');
		expect(document.activeElement?.id).toBe('own');
	});

	it('falls back to the place itself where it has no marker', () => {
		document.body.innerHTML = `<div class="place" id="p"><p id="text">tekst</p></div>`;
		const text = document.getElementById('text')!;
		let marker: HTMLElement | null = null;
		text.addEventListener('click', (e) => (marker = placeMarker(e, '.place')));
		text.click();
		expect(marker!.id).toBe('p');
	});
});
