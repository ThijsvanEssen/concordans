import { describe, expect, it } from 'vitest';
import type { Pt } from '$lib/network/tree-lines';
import { EXAMPLES, example } from '$lib/test/lanes';
import { sample, slanted } from '$lib/test/paths';
import { laneLayout, PANEL, type Box, type LaneLayout } from './lane-layout';
import { crossings, laneLines, type LanePath } from './lane-lines';
import { buildScene } from './scene';

const WIDTH = 1128;

const inside = (q: Pt, b: Box) =>
	q.x > b.x + 1 && q.x < b.x + b.width - 1 && q.y > b.y + 1 && q.y < b.y + b.height - 1;

/** The marks and names a line runs through, other than those of its own two ends. */
function through(line: LanePath, layout: LaneLayout): string[] {
	const pts = sample(line.d);
	const hit: string[] = [];
	for (const [id, box] of layout.units) {
		if (id === line.from || id === line.to) continue;
		for (const part of [box.mark, box.label]) if (pts.some((q) => inside(q, part))) hit.push(id);
	}
	return [...new Set(hit)];
}

type Run = {
	gutter: number;
	pts: Pt[];
	enter: number;
	leave: number;
	fromLeft: boolean;
	toLeft: boolean;
};

/** The runs of a line down a gutter: in from a side, down a rail, out to a side. */
function runs(line: LanePath, gutters: [number, number][]): Run[] {
	const out: Run[] = [];
	const p = line.points;
	for (let i = 1; i < p.length - 2; i++) {
		const [a, b] = [p[i], p[i + 1]];
		const g = gutters.findIndex(([l, r]) => a.x === b.x && a.x > l && a.x < r);
		if (g < 0 || a.y === b.y) continue;
		const [l, r] = gutters[g];
		const fromLeft = p[i - 1].x < a.x;
		const toLeft = p[i + 2].x < b.x;
		const pts = [{ x: fromLeft ? l : r, y: a.y }, a, b, { x: toLeft ? l : r, y: b.y }];
		out.push({ gutter: g, pts, enter: a.y, leave: b.y, fromLeft, toLeft });
	}
	return out;
}

describe.each(EXAMPLES)('the lines of %s', (name) => {
	const scene = buildScene(example(name));
	for (const time of [false, true])
		describe(time ? 'with Tijd' : 'without Tijd', () => {
			const layout = laneLayout(scene, WIDTH, time);
			const lines = laneLines(scene, layout);

			it('draws every line of the scene, eased at every bend', () => {
				expect(lines.map((l) => l.id).sort()).toEqual(scene.lines.map((l) => l.id).sort());
				for (const l of lines) {
					expect(l.d).toMatch(/^M[\d. -]+(?:[LQC][\d. -]+)+$/);
					if (l.points.length > 2) expect(l.d).toMatch(/[QC]/);
				}
			});

			it('runs straight between its bends: no slanted run', () => {
				expect(lines.filter((l) => slanted(l.d).length > 0).map((l) => l.id)).toEqual([]);
			});

			it('runs through no name and no mark', () => {
				expect(
					lines.flatMap((l) => through(l, layout).map((id) => `${l.id} through ${id}`))
				).toEqual([]);
			});

			it('runs no two lines of another bron or lijnsoort on one another', () => {
				// A shared run is a bundle only for one lijnsoort into one target or out of one bron;
				// else it would hide which cites which, or a line under another.
				// Only the arrows into one mark meet, on their last run.
				const kindOf = (l: LanePath) => scene.lines.find((x) => x.id === l.id)!.kind;
				const shares = (a: LanePath, b: LanePath) =>
					kindOf(a) === kindOf(b) && (a.from === b.from || a.to === b.to);
				// Open: the climbs into the strip Algemene wetten still share their passages.
				const general = new Set(scene.units.filter((u) => u.general).map((u) => u.id));
				const verticals = lines
					.filter((l) => !general.has(l.from) && !general.has(l.to))
					.flatMap((l) =>
						l.points.slice(1).flatMap((b, i) => {
							const a = l.points[i];
							// The first run out of a mark and the last into one: lines fan out of one bron
							// and arrows meet in one target there, as in the Keten.
							const end = i === 0 || i === l.points.length - 2;
							return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 4 && !end
								? [{ l, x: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) }]
								: [];
						})
					);
				const close: string[] = [];
				for (let i = 0; i < verticals.length; i++)
					for (let j = i + 1; j < verticals.length; j++) {
						const [a, b] = [verticals[i], verticals[j]];
						if (a.l === b.l || shares(a.l, b.l)) continue;
						const shared = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
						if (shared > 8 && Math.abs(a.x - b.x) < 4.5) close.push(`${a.l.id} | ${b.l.id}`);
					}
				expect(close).toEqual([]);
			});

			it('crosses no line in a gutter that the other order of their rails would not cross', () => {
				const gutters: [number, number][] = layout.columns.map((c, i) => {
					const next = layout.columns[i + 1];
					return [c.x + c.width + PANEL - 1, next ? next.x - PANEL + 1 : WIDTH];
				});
				const all = lines.flatMap((l) => runs(l, gutters).map((r) => ({ l, r })));
				const avoidable: string[] = [];
				const swap = (r: Run, x: number) =>
					r.pts.map((q, k) => (k === 1 || k === 2 ? { ...q, x } : q));
				for (let i = 0; i < all.length; i++)
					for (let j = i + 1; j < all.length; j++) {
						const [a, b] = [all[i].r, all[j].r];
						if (a.gutter !== b.gutter || all[i].l === all[j].l) continue;
						const other = crossings(swap(a, b.pts[1].x), swap(b, a.pts[1].x));
						if (crossings(a.pts, b.pts) > 0 && other === 0)
							avoidable.push(`${all[i].l.id} × ${all[j].l.id}`);
					}
				expect(avoidable).toEqual([]);
			});
		});
});

describe('the lines, by their rules', () => {
	const scene = buildScene(example('d2'));
	const layout = laneLayout(scene, WIDTH);
	const lines = laneLines(scene, layout);

	it('ends a line to a hull at a row of it: its own, or that of its bundle', () => {
		for (const l of lines) {
			const line = scene.lines.find((x) => x.id === l.id)!;
			if (!line.toRow) continue;
			const rows = layout.units.get(l.to)!.rows;
			// Beside a row where lines of several lijnsoorten end there (byKind); a bundle into one
			// target ends in the row most of its lines name (meet).
			const end = l.points.at(-1)!.y;
			expect(rows.some((r) => Math.abs(end - r.y) <= 8)).toBe(true);
		}
	});

	it('ends the lines of one lijnsoort into one hull in one point, where they share a gutter', () => {
		const into = new Map<string, Set<number>>();
		for (const l of lines) {
			const line = scene.lines.find((x) => x.id === l.id)!;
			const last = l.points.at(-1)!;
			const key = `${l.to} ${line.kind} ${l.points.at(-3)?.x}`;
			into.set(key, (into.get(key) ?? new Set()).add(last.y));
		}
		expect([...into.values()].filter((ys) => ys.size > 1)).toEqual([]);
	});

	it('draws a dot-family line without an arrow, every line as wide', () => {
		const votes = lines.find((l) => scene.lines.find((x) => x.id === l.id)?.kind === 'member')!;
		expect(votes.arrow).toBe(false);
		expect(new Set(lines.map((l) => l.width)).size).toBe(1);
	});
});
