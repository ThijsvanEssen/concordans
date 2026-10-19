import { describe, expect, it } from 'vitest';
import { articleAtTop, lawPosition } from './law-position.svelte';

describe('articleAtTop', () => {
	const articles = [
		{ number: '1', top: -400, bottom: -10 },
		{ number: '2', top: 0, bottom: 300 },
		{ number: '3', top: 320, bottom: 600 }
	];
	it('is the article across the line', () => {
		expect(articleAtTop(articles, 100)).toBe('2');
	});
	it('is the last above the line where it falls between two', () => {
		expect(articleAtTop(articles, 310)).toBe('2');
	});
	it('is none before the first', () => {
		expect(articleAtTop(articles, -500)).toBeNull();
	});
});

describe('lawPosition', () => {
	it('names the article of the law read, none of another', () => {
		lawPosition.set('BWBR0005537', '3:1');
		expect(lawPosition.of('bwbr0005537')).toBe('3:1');
		expect(lawPosition.of('BWBR0011353')).toBeNull();
		lawPosition.clear();
		expect(lawPosition.of('BWBR0005537')).toBeNull();
	});
});
