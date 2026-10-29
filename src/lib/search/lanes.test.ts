import { describe, expect, it } from 'vitest';
import { DEBOUNCE_MS, LANES, SEARCH_KINDS, searchMode } from './lanes';

describe('search lanes', () => {
	it('asks the fast kinds, the articles and stukken, and the judgments, each in a lane', () => {
		expect(LANES.map((l) => [l.id, l.kinds])).toEqual([
			[
				'fast',
				[
					'instruments',
					'dossiers',
					'cabinets',
					'ministries',
					'members',
					'commitments',
					'factions',
					'committees',
					'decisions'
				]
			],
			['text', ['articles', 'documents']],
			['judgments', ['judgments']]
		]);
	});

	it('puts every kind of the search in exactly one lane', () => {
		const inLanes = LANES.flatMap((l) => l.kinds);
		expect([...inLanes].sort()).toEqual([...SEARCH_KINDS].sort());
	});

	it('asks the fast kinds from two characters, the other lanes from three, after 150 ms', () => {
		expect(LANES.map((l) => l.minChars)).toEqual([2, 3, 3]);
		expect(DEBOUNCE_MS).toBe(150);
	});

	it('shows "Laden…" for the lanes that ask in full, the text and the judgments', () => {
		expect(LANES.filter((l) => l.showsLoading).map((l) => l.id)).toEqual(['text', 'judgments']);
		expect(LANES.filter((l) => l.full).map((l) => l.id)).toEqual(['text', 'judgments']);
	});

	it('aborts on typing on, fails as the whole search and names laws: the fast lane only', () => {
		const fast = (l: (typeof LANES)[number]) => l.id === 'fast';
		expect(LANES.every((l) => l.abortsOnRetype === fast(l))).toBe(true);
		expect(LANES.every((l) => l.failsAlone === !fast(l))).toBe(true);
		expect(LANES.every((l) => l.namesLaws === fast(l))).toBe(true);
	});

	it('asks the fast lane live, in full once "Meer …" asked for the query; the others in full', () => {
		expect(searchMode('huur', '')).toBe('live');
		expect(searchMode('huur', 'huu')).toBe('live');
		expect(searchMode('huur', 'huur')).toBe('full');
		expect(searchMode('huur', '', { full: true })).toBe('full');
	});
});
