import { describe, expect, it } from 'vitest';
import { WIDTH, LABEL_MAX, SKETCH_LIMIT, sketch, divide, type SketchGroup } from './sketch';
import type { Row } from './rows';

const rij = (
	collection: 'articles' | 'judgments' | 'documents',
	key: string,
	title = key
): Row => ({
	ref: { collection, key },
	title,
	context: null,
	filterGroup: 'artikelen'
});
const group = (
	id: string,
	count: number,
	collection: 'articles' | 'judgments' | 'documents',
	loaded = count
): SketchGroup => ({
	id,
	name: id,
	collection,
	count,
	rows: Array.from({ length: Math.min(count, loaded) }, (_, i) => rij(collection, `${id}${i}`))
});

describe('the network on request', () => {
	it('draws every bron on its own up to the limit', () => {
		const { singles, clusters } = divide([group('a', 13, 'articles'), group('k', 20, 'documents')]);
		expect(singles).toHaveLength(33);
		expect(clusters).toHaveLength(0);
	});

	it(`groups beyond ${SKETCH_LIMIT}: the large group becomes one bron with its count`, () => {
		const s = sketch([
			group('uitspraken', 10385, 'judgments', 25),
			group('kamerstukken', 132, 'documents', 25),
			group('artikelen', 13, 'articles')
		]);
		expect(s.singles).toHaveLength(13);
		expect(s.clusters.map((b) => [b.label, b.count])).toEqual([
			['uitspraken', 10385],
			['kamerstukken', 132]
		]);
		expect(s.inClusters).toBe(10517);
	});

	it('splits a group per instantie where the API counts them', () => {
		const uitspraken = {
			...group('judgments', 10385, 'judgments', 25),
			parts: [
				{ tier: 'hoge_raad' as const, label: 'Hoge Raad', count: 199 },
				{ tier: null, label: 'Overige instanties', count: 10186 }
			]
		};
		const { clusters } = divide([uitspraken]);
		expect(clusters.map((b) => [b.label, b.count, b.group])).toEqual([
			['Hoge Raad', 199, 'judgments'],
			['Overige instanties', 10186, 'judgments']
		]);
	});

	it('draws a group the API cut off as one, its rows not all there are', () => {
		const { singles, clusters } = divide([{ ...group('a', 2, 'documents'), capped: true }]);
		expect(singles).toHaveLength(0);
		expect(clusters).toHaveLength(1);
	});

	it('draws a bron in two groups once', () => {
		const a = group('a', 2, 'articles');
		const b = { ...group('b', 1, 'articles'), rows: [a.rows[0]] };
		expect(divide([a, b]).singles).toHaveLength(2);
	});

	it(`keeps names to ${LABEL_MAX} characters, inside the drawing`, () => {
		const lang = {
			...group('a', 1, 'articles'),
			rows: [rij('articles', 'x', 'Art. 2 Mandaatbesluit Raad voor de Kinderbescherming 2022')]
		};
		const s = sketch([lang, group('u', 500, 'judgments', 25)]);
		const [l] = s.singles;
		expect(l.label!.length).toBeLessThanOrEqual(LABEL_MAX);
		expect(l.label).toMatch(/…$/);
		const half = (l.label!.length * 6.2) / 2;
		expect(l.lx - half).toBeGreaterThanOrEqual(0);
		expect(l.lx + half).toBeLessThanOrEqual(WIDTH);
	});

	it('names every bron up to twelve, beyond that the first, the middle and the last', () => {
		expect(sketch([group('a', 12, 'articles')]).singles.every((l) => l.label)).toBe(true);
		const veel = sketch([group('a', 13, 'articles'), group('u', 500, 'judgments', 25)]).singles;
		expect(veel.filter((l) => l.label).map((l) => l.id)).toEqual([
			'articles/a0',
			'articles/a6',
			'articles/a12'
		]);
	});

	it('stands inside its height', () => {
		const s = sketch([group('a', 13, 'articles'), group('u', 6507, 'judgments', 25)]);
		for (const p of [...s.singles, ...s.clusters]) {
			expect(p.y).toBeGreaterThan(0);
			expect(p.y).toBeLessThan(s.height);
		}
	});
});
