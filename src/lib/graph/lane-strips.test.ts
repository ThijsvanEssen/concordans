import { describe, expect, it } from 'vitest';
import { EXAMPLES, example, shuffled } from '$lib/test/lanes';
import type { Pt } from '$lib/network/tree-lines';
import { sample, slanted } from '$lib/test/paths';
import type { Box } from './lane-layout';
import { laneStrips, stripLines } from './lane-strips';
import { buildScene } from './scene';

/** A phone. */
const WIDTH = 375;

const inside = (q: Pt, b: Box) =>
	q.x > b.x + 1 && q.x < b.x + b.width - 1 && q.y > b.y + 1 && q.y < b.y + b.height - 1;

const overlap = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe.each(EXAMPLES)('the strips of %s', (name) => {
	const scene = buildScene(example(name));
	for (const time of [false, true])
		describe(time ? 'with Tijd' : 'without Tijd', () => {
			const layout = laneStrips(scene, WIDTH, time);
			const boxes = [...layout.units];

			it('places every unit', () => {
				expect([...layout.units.keys()].sort()).toEqual(scene.units.map((u) => u.id).sort());
			});

			it('lets no two boxes overlap', () => {
				const out: string[] = [];
				for (let i = 0; i < boxes.length; i++)
					for (let j = i + 1; j < boxes.length; j++)
						if (overlap(boxes[i][1], boxes[j][1])) out.push(`${boxes[i][0]} ${boxes[j][0]}`);
				expect(out).toEqual([]);
			});

			it('keeps everything within the width of the screen, in its strip', () => {
				const strips = [...layout.columns, ...(layout.strip ? [layout.strip] : [])];
				for (const [id, b] of boxes) {
					expect(b.x, id).toBeGreaterThanOrEqual(16);
					expect(b.x + b.width, id).toBeLessThanOrEqual(WIDTH - 16);
					expect(
						strips.some((s) => b.y >= s.y && b.y + b.height <= s.y + s.height),
						id
					).toBe(true);
				}
			});

			it('stands the strips from top to bottom in the order of the columns', () => {
				const order = layout.columns.map((c) => c.column);
				const known = ['makers', 'papers', 'laws', 'rulings'].filter((c) =>
					order.includes(c as (typeof order)[number])
				);
				expect(order).toEqual(known);
				for (let i = 1; i < layout.columns.length; i++)
					expect(layout.columns[i].y).toBeGreaterThan(
						layout.columns[i - 1].y + layout.columns[i - 1].height
					);
			});

			it('names six units at most, besides a chosen hull', () => {
				expect(layout.named.size).toBeLessThanOrEqual(6);
			});

			it('draws only the lines to a chosen unit', () => {
				const focus = new Set(scene.units.filter((u) => u.focus).map((u) => u.id));
				for (const p of stripLines(scene, layout))
					expect(focus.has(p.from) || focus.has(p.to), p.id).toBe(true);
			});

			it('runs straight between its bends: no slanted run', () => {
				const lines = stripLines(scene, layout);
				expect(lines.filter((l) => slanted(l.d).length > 0).map((l) => l.id)).toEqual([]);
			});

			it('runs no line through a mark or a name other than its own ends', () => {
				const hits: string[] = [];
				for (const line of stripLines(scene, layout)) {
					const pts = sample(line.d);
					for (const [id, box] of layout.units) {
						if (id === line.from || id === line.to || line.id.startsWith('makers:')) continue;
						for (const part of [box.mark, box.label])
							if (pts.some((q) => inside(q, part))) hits.push(`${line.id} ${id}`);
					}
				}
				expect([...new Set(hits)]).toEqual([]);
			});

			it('is deterministic: the same bronnen in another order give the same strips', () => {
				const g = example(name);
				const again = buildScene({ ...g, nodes: shuffled(g.nodes), edges: shuffled(g.edges, 5) });
				expect(laneStrips({ ...again, units: shuffled(again.units, 11) }, WIDTH, time)).toEqual(
					layout
				);
			});
		});
});

describe('Tijd on a phone', () => {
	it('heads the stukken of Kamerstukken with their years, in order', () => {
		const layout = laneStrips(buildScene(example('v1')), WIDTH, true);
		const years = layout.years.map((y) => y.label);
		expect(years.length).toBeGreaterThan(1);
		expect([...years].sort()).toEqual(years);
	});
});
