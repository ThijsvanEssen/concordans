// The margin of the numbers of a text's places (an overweging, an alinea): as wide as the
// widest number (placeColumn). That PlaceNumber is the one number: guards/lezers.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { placeColumn } from './PlaceNumber.svelte';

afterEach(() => vi.restoreAllMocks());

describe('the number of a place', () => {
	it('gives the margin the width of the widest number, on the 4 px scale', async () => {
		// jsdom lays nothing out: a sign 7.3 px wide.
		Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
			configurable: true,
			value(this: Range) {
				return new DOMRect(0, 0, (this.startContainer.textContent ?? '').length * 7.3, 20);
			}
		});
		const text = document.createElement('div');
		text.innerHTML =
			'<span class="plaats-nummer">2.1</span><span class="plaats-nummer">5.3.2.1</span>';
		const action = placeColumn(text, 1);
		await tick();
		await tick();
		// 7 signs, 51.1 px: 52 px.
		expect(text.style.getPropertyValue('--plaats-num')).toBe('52px');
		text.innerHTML = '<span class="plaats-nummer">10000000</span>';
		action.update(2);
		await tick();
		await tick();
		expect(text.style.getPropertyValue('--plaats-num')).toBe('60px');
		action.destroy();
		delete (Range.prototype as Partial<Range>).getBoundingClientRect;
	});
});
