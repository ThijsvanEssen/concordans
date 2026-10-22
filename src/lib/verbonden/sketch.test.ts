import { describe, expect, it } from 'vitest';
import { WIDTH, LABEL_MAX, SKETCH_LIMIT, sketch, divide, wrap, type SketchGroup } from './sketch';
import type { Row } from './rows';

const row = (
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
	rows: Array.from({ length: Math.min(count, loaded) }, (_, i) => row(collection, `${id}${i}`))
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

	it(`wraps a name at its words, ${LABEL_MAX} characters a line, inside the drawing, never cut`, () => {
		const long = 'Art. 2 Mandaatbesluit Raad voor de Kinderbescherming 2022';
		const named = {
			...group('a', 1, 'articles'),
			rows: [row('articles', 'x', long)]
		};
		const s = sketch([named, group('u', 500, 'judgments', 25)]);
		const [l] = s.singles;
		expect(l.lines!.join(' ')).toBe(long);
		expect(l.lines!.every((line) => line.length <= LABEL_MAX)).toBe(true);
		const half = (Math.max(...l.lines!.map((x) => x.length)) * 6.2) / 2;
		expect(l.lx - half).toBeGreaterThanOrEqual(0);
		expect(l.lx + half).toBeLessThanOrEqual(WIDTH);
		expect(wrap('Overige instanties', 14)).toEqual(['Overige', 'instanties']);
	});

	it('names a circle in full, inside the drawing', () => {
		const s = sketch([
			{ ...group('u', 500, 'judgments', 25), name: 'Stemmingen, Eerste Kamer' },
			group('a', 13, 'articles')
		]);
		for (const c of s.clusters) {
			expect(c.lines.join(' ')).toBe(c.label);
			const half = (Math.max(...c.lines.map((x) => x.length)) * 6.2) / 2;
			expect(c.lx - half).toBeGreaterThanOrEqual(0);
			expect(c.lx + half).toBeLessThanOrEqual(WIDTH);
		}
	});

	it('leaves out a name that would cover another, never two over each other', () => {
		const s = sketch(
			[group('a', 30, 'articles'), group('u', 500, 'judgments', 25)],
			'Art. 6:162 BW'
		);
		const named = s.singles.filter((l) => l.lines);
		expect(named.length).toBeGreaterThan(1);
		expect(named.length).toBeLessThan(30);
		const box = (l: (typeof named)[number]) => {
			const half = (Math.max(...l.lines!.map((x) => x.length)) * 6.2) / 2;
			return {
				x0: l.lx - half,
				x1: l.lx + half,
				y0: l.ly - 11,
				y1: l.ly + (l.lines!.length - 1) * 14 + 4
			};
		};
		for (const [i, a] of named.entries())
			for (const b of named.slice(i + 1)) {
				const p = box(a);
				const q = box(b);
				expect(p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1, `${a.id} ${b.id}`).toBe(
					false
				);
			}
	});

	it('stands inside its height', () => {
		const s = sketch([group('a', 13, 'articles'), group('u', 6507, 'judgments', 25)]);
		for (const p of [...s.singles, ...s.clusters]) {
			expect(p.y).toBeGreaterThan(0);
			expect(p.y).toBeLessThan(s.height);
		}
	});
});
