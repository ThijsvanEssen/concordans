import { describe, expect, it } from 'vitest';
import { currentAddress } from './legacy-address';

const naar = (s: string) => currentAddress(new URL(s, 'https://x.test'))?.pathname;

describe('currentAddress', () => {
	it('carries mode=graph to the werkplek with the same bron', () => {
		const n = currentAddress(
			new URL('/wetten/BWBR0005289/artikel/6:162?mode=graph&diepte=3', 'https://x.test')
		);
		expect(n?.pathname).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(n?.search).toBe('?mode=netwerk&diepte=3');
	});
	it('carries mode=text to the reader', () => {
		expect(currentAddress(new URL('/explore?focus=a&mode=text', 'https://x.test'))?.search).toBe(
			'?focus=a'
		);
	});
	it('carries ?toon=netwerk with netwerk params to the werkplek, not the small network', () => {
		const n = currentAddress(
			new URL(
				'/explore?focus=articles/a&toon=netwerk&diepte=2&tussen=0&uit=REFERS_TO',
				'https://x.test'
			)
		);
		expect(n?.pathname).toBe('/explore');
		expect(n?.searchParams.get('mode')).toBe('netwerk');
		expect(n?.searchParams.has('toon')).toBe(false);
		expect(n?.searchParams.get('diepte')).toBe('2');
		expect(n?.searchParams.get('tussen')).toBe('0');
		expect(n?.searchParams.get('uit')).toBe('REFERS_TO');
	});
	it('leaves ?diepte alone', () => {
		expect(naar('/wetten/x?diepte=2')).toBeUndefined();
	});
	it('leaves ?toon=netwerk without netwerk params to Verbonden', () => {
		expect(naar('/explore?focus=a&toon=netwerk')).toBeUndefined();
	});
	it('leaves a current address alone', () => {
		expect(naar('/explore?focus=a&mode=netwerk&overlay=open')).toBeUndefined();
		expect(naar('/wetten/x?toon=netwerk')).toBeUndefined();
	});
});
