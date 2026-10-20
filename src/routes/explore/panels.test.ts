import { describe, expect, it } from 'vitest';
import { PANELS, panelOfKey, verbondenInView, type Panel } from './panels';

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

describe('Verbonden in view', () => {
	it('loads beside the reader, and on a phone for its tab, the table or an article', () => {
		const phone = (panel: Panel, table = false) => ({ phone: true, table, panel });
		expect(verbondenInView('judgments', { phone: false, table: false, panel: 'reader' })).toBe(
			true
		);
		expect(verbondenInView('judgments', phone('reader'))).toBe(false);
		expect(verbondenInView('judgments', phone('verbonden'))).toBe(true);
		// F8: /uitspraken/…?tabel=1 loaded directly on a phone said 0 verbindingen.
		expect(verbondenInView('judgments', phone('reader', true))).toBe(true);
		expect(verbondenInView('articles', phone('reader'))).toBe(true);
	});
});
