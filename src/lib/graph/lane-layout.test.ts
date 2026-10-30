import { describe, expect, it } from 'vitest';
import { EXAMPLES, example, shuffled } from '$lib/test/lanes';
import {
	CONTENT_TOP,
	GUTTER,
	laneLayout,
	wrapLabel,
	type Box,
	type LaneLayout
} from './lane-layout';
import { buildScene, type Scene } from './scene';

/** The canvas beside the panel on a screen of 1440. */
const WIDTH = 1128;

const overlap = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Every pair of units whose boxes overlap. */
function overlaps(layout: LaneLayout): string[] {
	const boxes = [...layout.units];
	const out: string[] = [];
	for (let i = 0; i < boxes.length; i++)
		for (let j = i + 1; j < boxes.length; j++)
			if (overlap(boxes[i][1], boxes[j][1])) out.push(`${boxes[i][0]} ${boxes[j][0]}`);
	return out;
}

/** The units that stand outside their column (or outside the strip). */
function outside(scene: Scene, layout: LaneLayout): string[] {
	const columns = new Map(layout.columns.map((c) => [c.column, c]));
	return scene.units
		.filter((u) => {
			const box = layout.units.get(u.id)!;
			const frame = u.general ? layout.strip! : columns.get(u.column)!;
			return box.x < frame.x || box.x + box.width > frame.x + frame.width;
		})
		.map((u) => u.id);
}

describe.each(EXAMPLES)('the layout of %s', (name) => {
	const scene = buildScene(example(name));
	for (const time of [false, true])
		describe(time ? 'with Tijd' : 'without Tijd', () => {
			const layout = laneLayout(scene, WIDTH, time);

			it('places every unit', () => {
				expect([...layout.units.keys()].sort()).toEqual(scene.units.map((u) => u.id).sort());
			});

			it('lets no two boxes overlap', () => {
				expect(overlaps(layout)).toEqual([]);
			});

			it('keeps every unit in its column, the general ones in their strip', () => {
				expect(outside(scene, layout)).toEqual([]);
			});

			it('keeps a gutter between two columns, and the strip under them all', () => {
				for (let i = 1; i < layout.columns.length; i++) {
					const a = layout.columns[i - 1];
					expect(layout.columns[i].x - (a.x + a.width)).toBe(GUTTER);
				}
				if (layout.strip)
					for (const c of layout.columns) expect(layout.strip.y).toBeGreaterThan(c.y + c.height);
			});

			it('is as high as what it holds', () => {
				const bottom = Math.max(...[...layout.units.values()].map((b) => b.y + b.height));
				expect(layout.height).toBeGreaterThan(bottom);
				expect(layout.height).toBeLessThan(bottom + 120);
			});

			it('is deterministic: the same bronnen in another order give the same layout', () => {
				const g = example(name);
				const again = buildScene({ ...g, nodes: shuffled(g.nodes), edges: shuffled(g.edges, 5) });
				expect(laneLayout({ ...again, units: shuffled(again.units, 11) }, WIDTH, time)).toEqual(
					layout
				);
			});
		});
});

describe('the layout, by its rules', () => {
	const scene = buildScene(example('d2'));
	const layout = laneLayout(scene, WIDTH);

	it('puts Wie maakt in its cards: Regering, Raad van State, Parlement', () => {
		expect(layout.lanes.map((l) => l.lane)).toEqual(['government', 'council', 'parliament']);
		for (const u of scene.units.filter((x) => x.column === 'makers')) {
			const card = layout.lanes.find((l) => l.lane === u.lane)!;
			const box = layout.units.get(u.id)!;
			expect(box.y).toBeGreaterThan(card.y);
			expect(box.y + box.height).toBeLessThan(card.y + card.height);
		}
	});

	it('puts the chosen unit first in its column', () => {
		const papers = scene.units
			.filter((u) => u.column === 'papers')
			.map((u) => layout.units.get(u.id)!.y);
		expect(layout.units.get('dossiers/36702')!.y).toBe(Math.min(...papers));
		expect(layout.units.get('dossiers/36702')!.y).toBe(CONTENT_TOP);
	});

	it('gives each row of a hull its own height, in the order of the rows', () => {
		const rows = layout.units.get('dossiers/36702')!.rows;
		expect(rows.map((r) => r.id)).toEqual([
			'bill',
			'letters',
			'activities',
			'amendments',
			'motions',
			'votes'
		]);
		for (let i = 1; i < rows.length; i++) expect(rows[i].y).toBeGreaterThan(rows[i - 1].y);
	});

	it('puts Wetten one bron a line', () => {
		const laws = scene.units.filter((u) => u.column === 'laws').map((u) => layout.units.get(u.id)!);
		const column = layout.columns.find((c) => c.column === 'laws')!;
		for (const box of laws) expect(box.x).toBe(column.x);
	});

	it('in Tijd, stands Kamerstukken and Rechtspraak by date', () => {
		const timed = laneLayout(buildScene(example('v1')), WIDTH, true);
		const dated = buildScene(example('v1'))
			.units.filter(
				(u) => !u.general && u.date && (u.column === 'papers' || u.column === 'rulings')
			)
			.map((u) => ({ column: u.column, date: u.date!, y: timed.units.get(u.id)!.y }));
		for (const column of ['papers', 'rulings'])
			for (const a of dated.filter((d) => d.column === column))
				for (const b of dated.filter((d) => d.column === column && d.date > a.date))
					expect(b.y).toBeGreaterThan(a.y);
		expect(timed.axis?.ticks.some((t) => t.kind === 'year')).toBe(true);
	});

	it('puts the general wetten in the first line of the strip, each column below on its own', () => {
		const v1 = buildScene(example('v1'));
		const strip = laneLayout(v1, WIDTH);
		const general = v1.units.filter((u) => u.general);
		const top = (column: string, law: boolean) =>
			general
				.filter((u) => u.column === column && (u.shape !== 'group') === law)
				.map((u) => strip.units.get(u.id)!);
		const laws = top('laws', true);
		const first = Math.min(...general.map((u) => strip.units.get(u.id)!.y));
		expect(laws.map((b) => b.y)).toEqual(laws.map(() => first));
		const below = Math.max(...laws.map((b) => b.y + b.height));
		for (const box of [...top('papers', false), ...top('laws', false), ...top('rulings', false)])
			expect(box.y).toBeGreaterThan(below);
	});
});

describe('wrapLabel', () => {
	it('breaks a name at words, at most three lines, the last cut with …', () => {
		expect(
			wrapLabel('Wet aanvullende bepalingen verwerking persoonsgegevens in de zorg', 140)
		).toEqual(['Wet aanvullende', 'bepalingen verwerking', 'persoonsgegevens in…']);
	});
});
