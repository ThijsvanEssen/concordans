import { describe, expect, it } from 'vitest';
import { PANELS, panelOfKey } from './panels';

describe('the panels', () => {
	it('are Tekst, Netwerk and Verbonden, under the keys 1, 2 and 3', () => {
		expect(PANELS.map((p) => [p.key, p.label])).toEqual([
			['1', 'Tekst'],
			['2', 'Netwerk'],
			['3', 'Verbonden']
		]);
		expect(PANELS.map((p) => panelOfKey(p.key))).toEqual(PANELS.map((p) => p.id));
		expect(panelOfKey('4')).toBeUndefined();
	});
});
