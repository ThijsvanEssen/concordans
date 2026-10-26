import { describe, expect, it } from 'vitest';
import { namedByHeader, withoutHeaderDupes } from './header-dupes';
import type { Group } from './groups';
import type { Row } from './rows';

const row = (collection: string, key: string, extra: object = {}) =>
	({ ref: { collection, key, ...extra } }) as unknown as Row;
const wet = {
	collection: 'instruments',
	key: 'bwbr0050000',
	props: { dossier_numbers: ['36764'], enacted_publication: 'stb-2026-187' }
};

describe('what the heading already names', () => {
	it('is the bron itself, its dossier and its own publication', () => {
		expect(namedByHeader(row('instruments', 'bwbr0050000'), wet)).toBe(true);
		expect(namedByHeader(row('dossiers', 'x', { number: '36764' }), wet)).toBe(true);
		expect(namedByHeader(row('instruments', 'stb-2026-187'), wet)).toBe(true);
	});
	it('is not another dossier or publication', () => {
		expect(namedByHeader(row('dossiers', 'x', { number: '1' }), wet)).toBe(false);
		expect(namedByHeader(row('instruments', 'stb-2026-188'), wet)).toBe(false);
	});
	it('is the law of an article', () => {
		const art = { collection: 'articles', key: 'bwbr0050000_3', props: {} };
		expect(namedByHeader(row('instruments', 'bwbr0050000'), art)).toBe(true);
		expect(namedByHeader(row('instruments', 'bwbr0099999'), art)).toBe(false);
	});
	it('drops an emptied group and lowers a total', () => {
		const g = (id: string, rows: Row[], total: number) => ({ id, rows, total }) as unknown as Group;
		const out = withoutHeaderDupes(
			[
				g('a', [row('dossiers', 'x', { number: '36764' })], 1),
				g('b', [row('instruments', 'bwbr0050000'), row('instruments', 'o')], 5)
			],
			wet
		);
		expect(out.map((x) => x.id)).toEqual(['b']);
		expect(out[0].total).toBe(4);
	});
});
