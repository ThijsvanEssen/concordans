import { describe, expect, it } from 'vitest';
import { PANELS, panelOfKey, verbondenInView, type Panel } from './panels';

describe('the panels', () => {
	it('are Tekst and Verbonden, under the keys 1 and 2', () => {
		expect(PANELS.map((p) => [p.key, p.label])).toEqual([
			['1', 'Tekst'],
			['2', 'Verbonden']
		]);
		expect(PANELS.map((p) => panelOfKey(p.key))).toEqual(PANELS.map((p) => p.id));
		expect(panelOfKey('3')).toBeUndefined();
	});
});

describe('Verbonden in view', () => {
	it('loads beside the reader, and on a phone for its tab, the table or an article', () => {
		const phone = (panel: Panel, table = false) => ({ phone: true, table, panel });
		expect(verbondenInView('judgments', { phone: false, table: false, panel: 'tekst' })).toBe(true);
		expect(verbondenInView('judgments', phone('tekst'))).toBe(false);
		expect(verbondenInView('judgments', phone('verbonden'))).toBe(true);
		// F8: /uitspraken/…?tabel=1 loaded directly on a phone said 0 verbindingen.
		expect(verbondenInView('judgments', phone('tekst', true))).toBe(true);
		expect(verbondenInView('articles', phone('tekst'))).toBe(true);
		// N1: the werkplek's legend counts as Verbonden, on a phone too.
		expect(verbondenInView('judgments', { ...phone('tekst'), canvasOnly: true })).toBe(true);
	});
});
