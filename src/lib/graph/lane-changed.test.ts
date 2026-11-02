import { describe, expect, it } from 'vitest';
import { example } from '$lib/test/lanes';
import { CONTENT_TOP, laneLayout } from './lane-layout';
import { laneStrips } from './lane-strips';
import { buildScene, type Scene, type SceneUnit } from './scene';

const WIDTH = 1200;
const d2 = (): Scene => buildScene(example('d2'));
const laws = (s: Scene) => s.units.filter((u) => u.column === 'laws' && !u.general);

const withChanges = (s: Scene, changes: Record<string, SceneUnit['change']>): Scene => ({
	...s,
	units: s.units.map((u) => (u.id in changes ? { ...u, change: changes[u.id] } : u))
});

describe('a changed wet on the lanes', () => {
	it('is a wet a line of Wijziging goes to, and no other unit', () => {
		const s = d2();
		const targets = new Set(s.lines.filter((l) => l.kind === 'change').map((l) => l.to));
		const changed = s.units.filter((u) => u.change);
		expect(changed.length).toBeGreaterThan(0);
		for (const u of changed) {
			expect(u.column).toBe('laws');
			expect(targets.has(u.id)).toBe(true);
		}
	});

	it('counts as changed through a publication, as proposed through a paper alone', () => {
		const s = d2();
		const lines = s.lines.filter((l) => l.kind === 'change');
		for (const u of s.units.filter((o) => o.change)) {
			const own = lines.filter((l) => l.to === u.id);
			expect(u.change).toBe(own.some((l) => !l.proposed) ? 'enacted' : 'proposed');
		}
	});

	it('stands under its head, in the order Gewijzigd, Voorgesteld, Overige wetten', () => {
		const s = d2();
		const [a, b] = laws(s).filter((u) => !u.focus);
		const mixed = withChanges(
			{ ...s, units: s.units.map((u) => ({ ...u, change: null })) },
			{ [a.id]: 'proposed', [b.id]: 'enacted' }
		);
		const layout = laneLayout(mixed, WIDTH);
		expect(layout.heads.map((h) => h.label)).toEqual([
			'Gewijzigd',
			'Voorgesteld',
			'Overige wetten'
		]);
		const [enacted, proposed, others] = layout.heads;
		const y = (id: string) => layout.units.get(id)!.y;
		expect(y(b.id)).toBeGreaterThan(enacted.y);
		expect(y(b.id)).toBeLessThan(proposed.y);
		expect(y(a.id)).toBeGreaterThan(proposed.y);
		expect(y(a.id)).toBeLessThan(others.y);
	});

	it('gives the first head air under the bar of the column', () => {
		const [first] = laneLayout(d2(), WIDTH).heads;
		expect(first.y - 11).toBeGreaterThanOrEqual(CONTENT_TOP);
	});

	it('stands on top without a head when it is chosen, whatever its change', () => {
		const s = d2();
		const pick = laws(s).find((u) => !u.change)!;
		const chosen = { ...s, units: s.units.map((u) => (u === pick ? { ...u, focus: true } : u)) };
		const layout = laneLayout(chosen, WIDTH);
		expect(layout.units.get(pick.id)!.y).toBeLessThan(layout.heads[0].y);
	});

	it('draws no heads where only the chosen wet changes', () => {
		const s = d2();
		const [pick] = laws(s);
		const alone = {
			...s,
			units: s.units.map((u) =>
				u === pick ? { ...u, focus: true, change: 'proposed' as const } : { ...u, change: null }
			)
		};
		expect(laneLayout(alone, WIDTH).heads).toEqual([]);
	});

	it('leaves room in its pill for the marker', () => {
		const s = d2();
		const hull = { ...laws(s)[0], shape: 'hull' as const, rows: [], change: 'enacted' as const };
		const short = { ...s, lines: [], units: [{ ...hull, label: 'Jeugdwet' }] };
		const without = { ...s, lines: [], units: [{ ...hull, label: 'Jeugdwet', change: null }] };
		const width = (o: Scene) => laneLayout(o, WIDTH).units.get(hull.id)!.label.width;
		expect(width(short)).toBeGreaterThan(width(without));
	});

	it('comes first on a phone and carries a name there', () => {
		const s = d2();
		const strips = laneStrips(s, 375);
		const at = (id: string) => strips.units.get(id)!;
		const changed = laws(s).filter((u) => u.change);
		const others = laws(s).filter((u) => !u.change && !u.focus);
		const lastChanged = Math.max(...changed.map((u) => at(u.id).y));
		for (const u of changed) expect(strips.units.get(u.id)!.text.name.length).toBe(1);
		for (const u of others) expect(at(u.id).y).toBeGreaterThanOrEqual(lastChanged);
		expect(strips.heads).toEqual([]);
	});
});
