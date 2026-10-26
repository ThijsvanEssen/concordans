import { describe, expect, it } from 'vitest';
import { keepsCamera, saveCamera, savedCamera } from './camera';

const at = { x: 0.3, y: 0.7, ratio: 0.5 };

/** One mount of GraphView: it draws the bronnen, then restores the kept camera or fits. */
function mount(ids: string[]) {
	const keep = keepsCamera(new Set(ids));
	return keep ? savedCamera() : null;
}

describe('the netwerk camera', () => {
	it('survives a remount with the same bronnen', () => {
		expect(mount(['a', 'b'])).toBeNull();
		saveCamera(at);
		expect(mount(['a', 'b'])).toEqual(at);
	});

	it('stays when bronnen are added', () => {
		mount(['a']);
		saveCamera(at);
		expect(mount(['a', 'b'])).toEqual(at);
	});

	it('is dropped for another set of bronnen', () => {
		mount(['a', 'b']);
		saveCamera(at);
		expect(mount(['c'])).toBeNull();
		expect(savedCamera()).toBeNull();
	});
});
