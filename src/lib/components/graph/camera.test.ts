import { describe, expect, it } from 'vitest';
import { keepsCamera, saveCamera, savedCamera } from './camera';

const at = { x: 0.3, y: 0.7, ratio: 0.5 };

/** One mount of GraphView: it draws the bronnen, then restores the kept camera or fits. */
function mount(width: 'full' | 'compact', ids: string[]) {
	const keep = keepsCamera(width, new Set(ids));
	return keep ? savedCamera(width) : null;
}

describe('the netwerk camera', () => {
	it('survives a remount with the same bronnen', () => {
		expect(mount('full', ['a', 'b'])).toBeNull();
		saveCamera('full', at);
		expect(mount('full', ['a', 'b'])).toEqual(at);
	});

	it('stays when bronnen are added', () => {
		mount('full', ['a']);
		saveCamera('full', at);
		expect(mount('full', ['a', 'b'])).toEqual(at);
	});

	it('is dropped for another set of bronnen', () => {
		mount('full', ['a', 'b']);
		saveCamera('full', at);
		expect(mount('full', ['c'])).toBeNull();
		expect(savedCamera('full')).toBeNull();
	});

	it('is kept per width', () => {
		mount('full', ['a']);
		saveCamera('full', at);
		expect(mount('compact', ['a'])).toBeNull();
		expect(mount('full', ['a'])).toEqual(at);
	});
});
