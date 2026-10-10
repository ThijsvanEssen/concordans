import { describe, expect, it } from 'vitest';
import { naFilter, zichtSleutel } from './zicht';

const sleutel = (verborgen: string[], van: string | null = null) =>
	zichtSleutel({ verborgen: new Set(verborgen) as never, rechter: null, van, tot: null });

describe('the camera after a filter (zicht.ts)', () => {
	it('leaves the first look to the load', () => {
		expect(naFilter(null, sleutel([]))).toBe(false);
	});

	it('frames what is left when the filter changes, and again when it is cleared', () => {
		const alles = sleutel([]);
		const minder = sleutel(['uitspraken', 'artikelen']);
		expect(naFilter(alles, minder)).toBe(true);
		expect(naFilter(minder, alles)).toBe(true);
		expect(naFilter(minder, sleutel(['uitspraken', 'artikelen'], '2020-01-01'))).toBe(true);
	});

	it('does nothing when the key stays the same', () => {
		expect(naFilter(sleutel(['a', 'b']), sleutel(['b', 'a']))).toBe(false);
	});
});
