import { describe, expect, it } from 'vitest';
import { sectionAtTop } from './toc-position.svelte';

describe('sectionAtTop', () => {
	const s = [
		{ id: 'a', top: -300 },
		{ id: 'b', top: -20 },
		{ id: 'c', top: 400 }
	];
	it('is the last section that has begun', () => {
		expect(sectionAtTop(s, 80)).toBe('b');
		expect(sectionAtTop(s, 500)).toBe('c');
	});
	it('is none while the text stands above the first', () => {
		expect(sectionAtTop([{ id: 'a', top: 200 }], 80)).toBeNull();
		expect(sectionAtTop([], 80)).toBeNull();
	});
});
