import { describe, expect, it } from 'vitest';
import { enigJaar, sorteer, type TijdRegel } from './tijdlijn';

const regel = (id: string, datum: string | null): TijdRegel => ({
	id,
	datum,
	teken: datum ? 'stuk' : 'verwacht',
	zin: id
});

describe('sorteer', () => {
	const regels = [
		regel('c', '2025-12-12'),
		regel('nog', null),
		regel('a1', '2024-05-31'),
		regel('b', '2024-06-14'),
		regel('a2', '2024-05-31T10:00:00')
	];

	it('puts a course from old to new, one day keeping its order, what may follow last', () => {
		expect(sorteer(regels, 'oplopend').map((r) => r.id)).toEqual(['a1', 'a2', 'b', 'c', 'nog']);
	});

	it('puts an overview from new to old', () => {
		expect(sorteer(regels, 'aflopend').map((r) => r.id)).toEqual(['c', 'b', 'a1', 'a2', 'nog']);
	});
});

describe('enigJaar', () => {
	it('gives the one year of a group, none where it spans more', () => {
		expect(enigJaar([regel('a', '2024-02-05'), regel('n', null)])).toBe('2024');
		expect(enigJaar([regel('a', '2024-02-05'), regel('b', '2025-01-01')])).toBeNull();
		expect(enigJaar([])).toBeNull();
	});
});
