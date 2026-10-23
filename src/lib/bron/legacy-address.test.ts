import { describe, expect, it } from 'vitest';
import { currentAddress } from './legacy-address';

const naar = (s: string) => currentAddress(new URL(s, 'https://x.test'))?.pathname;

describe('currentAddress', () => {
	it('carries mode=graph to the werkplek with the same bron', () => {
		const n = currentAddress(
			new URL('/wetten/BWBR0005289/artikel/6:162?mode=graph&diepte=3', 'https://x.test')
		);
		expect(n?.pathname).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(n?.search).toBe('?mode=netwerk');
	});
	it('carries mode=text to the reader', () => {
		expect(currentAddress(new URL('/explore?focus=a&mode=text', 'https://x.test'))?.search).toBe(
			'?focus=a'
		);
	});
	it('leaves a current address alone', () => {
		expect(naar('/explore?focus=a&mode=netwerk&overlay=open')).toBeUndefined();
		expect(naar('/wetten/x?toon=netwerk')).toBeUndefined();
	});
});
