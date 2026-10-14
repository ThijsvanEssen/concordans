import { describe, expect, it } from 'vitest';
import { DEBOUNCE_MS, LANE_MIN_CHARS, LANEN, searchMode } from './lanen';

describe('search lanes', () => {
	it('asks the articles and stukken, and the judgments, each in a lane of its own', () => {
		expect(LANEN.map((l) => [l.id, l.kinds])).toEqual([
			['tekst', ['articles', 'documents']],
			['uitspraken', ['judgments']]
		]);
	});

	it('asks every lane from three characters, after a pause of 150 ms', () => {
		expect(LANE_MIN_CHARS).toBe(3);
		expect(DEBOUNCE_MS).toBe(150);
	});

	it('shows "Laden…" only for the judgments', () => {
		expect(LANEN.filter((l) => l.laden).map((l) => l.id)).toEqual(['uitspraken']);
	});

	it('asks in the live mode while typing, in full once "Meer …" asked for the query', () => {
		expect(searchMode('huur', '')).toBe('live');
		expect(searchMode('huur', 'huu')).toBe('live');
		expect(searchMode('huur', 'huur')).toBe('full');
	});
});
