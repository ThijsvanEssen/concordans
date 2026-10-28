import { describe, expect, it } from 'vitest';
import {
	WIDTH,
	LABEL_MAX,
	SKETCH_LIMIT,
	sketch,
	divide,
	drawnCount,
	wrap,
	type SketchGroup
} from './sketch';
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

describe('the line under the drawing', () => {
	it('counts the bronnen on their own and the groups with what they hold', () => {
		const s = sketch(
			[group('a', 7, 'articles'), group('uitspraken', 38, 'judgments', 25)],
			'x',
			10
		);
		expect(drawnCount(s)).toBe('7 bronnen, 1 groep van 38 uitspraken');
	});
	it('says bron at one, and bronnen of groups of several kinds', () => {
		expect(drawnCount(sketch([group('a', 1, 'articles')]))).toBe('1 bron');
		const s = sketch(
			[group('u', 300, 'judgments', 25), group('k', 200, 'documents', 25)],
			'x',
			SKETCH_LIMIT
		);
		expect(drawnCount(s)).toBe('2 groepen van 500 bronnen');
	});
});

describe('a line of the drawing', () => {
	it('knows whom it comes from: the other bron when it names the one in the middle', () => {
		const inkomend: Row = {
			...row('judgments', 'j1'),
			relation: 'REFERS_TO',
			direction: 'inbound'
		};
		const s = sketch([{ ...group('u', 1, 'judgments'), rows: [inkomend] }], 'x');
		expect(s.singles[0]).toMatchObject({ relation: 'REFERS_TO', source: 'judgment' });
		const uitgaand: Row = { ...inkomend, direction: 'outbound' };
		const t = sketch(
			[{ ...group('u', 1, 'judgments'), rows: [uitgaand] }],
			'x',
			SKETCH_LIMIT,
			'judgment'
		);
		expect(t.singles[0].source).toBe('judgment');
	});
});

describe('wrap, a word longer than a line', () => {
	it('breaks it with a hyphen, so it stays inside the drawing', () => {
		const lines = wrap('Ondermandaatbesluit Rijkswaterstaat', 14);
		expect(lines.every((l) => l.length <= 14)).toBe(true);
		expect(lines.join('').replaceAll('-', '')).toBe('OndermandaatbesluitRijkswaterstaat');
	});
});

describe('the hulls of the canvas, drawn small', () => {
	const lid = (key: string): Row => ({
		...row('documents', key),
		relation: 'PART_OF',
		direction: 'inbound'
	});

	it('draws a dossier as the hull of its members, the lines of the members as one', () => {
		const dossier: Row = {
			ref: { collection: 'dossiers', key: '36496', number: '36496' },
			title: 'Wet betaalbare huur',
			context: null,
			filterGroup: 'artikelen'
		};
		const stuk: Row = {
			...row('documents', 'st1'),
			relation: 'AMENDS',
			direction: 'inbound',
			props: { dossier_number: '36496' }
		};
		const s = sketch(
			[
				{ ...group('dossiers', 1, 'documents'), rows: [dossier] },
				{ ...group('stukken', 1, 'documents'), rows: [stuk] }
			],
			'Art. 7:248'
		);
		expect(s.hulls.map((h) => [h.id, h.kind, h.label])).toEqual([
			['dossier:36496', 'dossier', 'Wet betaalbare huur']
		]);
		// The dossier is no bron of its own; its member stands in the hull and has no line.
		expect(s.singles.map((l) => [l.id, l.hull, l.joined])).toEqual([
			['documents/st1', 'dossier:36496', true]
		]);
		expect(s.hulls[0].line).toMatchObject({ relation: 'AMENDS', direction: 'inbound' });
		const d = s.singles[0];
		expect(Math.hypot(d.x - s.hulls[0].x, d.y - s.hulls[0].y)).toBeLessThan(s.hulls[0].r);
	});

	it('draws the bron in the middle as a hull where it is a container with members', () => {
		const s = sketch(
			[{ ...group('stukken', 3, 'documents'), rows: ['a', 'b', 'c'].map(lid) }],
			'Wet betaalbare huur',
			SKETCH_LIMIT,
			'dossier',
			{ centreKind: 'dossier' }
		);
		expect(s.hulls).toHaveLength(1);
		expect(s.hulls[0]).toMatchObject({
			kind: 'dossier',
			centre: true,
			label: 'Wet betaalbare huur'
		});
		expect(s.singles.every((l) => l.hull === 'centre' && l.joined)).toBe(true);
		for (const l of s.singles)
			expect(Math.hypot(l.x - s.hulls[0].x, l.y - s.hulls[0].y)).toBeLessThan(s.hulls[0].r);
	});

	it('keeps the middle a bron where no member is there, and a law round an article', () => {
		const alone = sketch([group('a', 2, 'articles')], 'Wet', SKETCH_LIMIT, 'dossier', {
			centreKind: 'dossier'
		});
		expect(alone.hulls).toEqual([]);
		const art = sketch([group('a', 2, 'articles')], 'Art. 7:248', SKETCH_LIMIT, 'article', {
			home: 'BW'
		});
		expect(art.hulls.map((h) => [h.id, h.kind, h.label])).toEqual([['home', 'instrument', 'BW']]);
	});

	it('puts a soort of more than a hull holds inside it as one cluster', () => {
		const s = sketch(
			[
				{
					...group('stukken', 30, 'documents'),
					rows: Array.from({ length: 30 }, (_, i) => lid(`d${i}`))
				}
			],
			'Dossier',
			SKETCH_LIMIT,
			'dossier',
			{ centreKind: 'dossier' }
		);
		expect(s.singles).toHaveLength(0);
		expect(s.clusters.map((b) => [b.count, b.hull])).toEqual([[30, 'centre']]);
	});
});
