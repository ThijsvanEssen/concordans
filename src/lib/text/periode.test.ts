import { describe, expect, it } from 'vitest';
import { alsDag, gekozen, maandenTerug } from './periode';

describe('periode', () => {
	it('goes back whole months, to the last day where the month is shorter', () => {
		expect(maandenTerug('2026-10-09', 1)).toBe('2026-09-09');
		expect(maandenTerug('2026-10-09', 12)).toBe('2025-10-09');
		expect(maandenTerug('2026-05-31', 3)).toBe('2026-02-28');
	});

	it('knows a preset again, and a period of its own', () => {
		expect(gekozen('', '', '2026-10-09')).toBe('alles');
		expect(gekozen('2026-07-09', '', '2026-10-09')).toBe('kwartaal');
		expect(gekozen('2026-07-09', '2026-08-01', '2026-10-09')).toBeNull();
		expect(gekozen('2020-01-01', '', '2026-10-09')).toBeNull();
	});

	it('reads a year from an older address as its first or last day', () => {
		expect(alsDag('2015', false)).toBe('2015-01-01');
		expect(alsDag('2015', true)).toBe('2015-12-31');
		expect(alsDag('2015-03-02', true)).toBe('2015-03-02');
		expect(alsDag('maart', false)).toBeNull();
	});
});
