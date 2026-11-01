import { describe, expect, it } from 'vitest';
import { example } from '$lib/test/lanes';
import { CONTENT_TOP, laneLayout } from './lane-layout';
import { laneStrips } from './lane-strips';
import { buildScene, type Scene } from './scene';

const WIDTH = 1200;
const d2 = (): Scene => buildScene(example('d2'));
const laws = (s: Scene) => s.units.filter((u) => u.column === 'laws' && !u.general);

describe('a changed wet on the lanes', () => {
	it('is a wet a line of Wijziging goes to, and no other unit', () => {
		const s = d2();
		const targets = new Set(s.lines.filter((l) => l.kind === 'change').map((l) => l.to));
		const changed = s.units.filter((u) => u.changed);
		expect(changed.length).toBeGreaterThan(0);
		for (const u of changed) {
			expect(u.column).toBe('laws');
			expect(targets.has(u.id)).toBe(true);
		}
	});

	it('stands first under its head, the others under theirs', () => {
		const s = d2();
		const layout = laneLayout(s, WIDTH);
		const y = (id: string) => layout.units.get(id)!.y;
		const changed = laws(s).filter((u) => u.changed);
		const others = laws(s).filter((u) => !u.changed);
		expect(layout.heads.map((h) => h.label)).toEqual(['Gewijzigd', 'Overige wetten']);
		const [first, second] = layout.heads;
		expect(Math.max(...changed.map((u) => y(u.id)))).toBeLessThan(second.y);
		expect(Math.min(...changed.map((u) => y(u.id)))).toBeGreaterThan(first.y);
		expect(Math.min(...others.map((u) => y(u.id)))).toBeGreaterThan(second.y);
	});

	it('gives the head air under the bar of the column', () => {
		const [first] = laneLayout(d2(), WIDTH).heads;
		expect(first.y - 11).toBeGreaterThanOrEqual(CONTENT_TOP);
	});

	it('leaves a chosen wet that is not changed on top, without a head', () => {
		const s = d2();
		const pick = laws(s).find((u) => !u.changed)!;
		const chosen = { ...s, units: s.units.map((u) => (u === pick ? { ...u, focus: true } : u)) };
		const layout = laneLayout(chosen, WIDTH);
		expect(layout.units.get(pick.id)!.y).toBeLessThan(layout.heads[0].y);
	});

	it('draws no heads where no wet is changed', () => {
		const s = d2();
		const none = { ...s, units: s.units.map((u) => ({ ...u, changed: false })) };
		expect(laneLayout(none, WIDTH).heads).toEqual([]);
	});

	it('leaves room in its pill for the marker', () => {
		const s = d2();
		const hull = { ...laws(s)[0], shape: 'hull' as const, rows: [], changed: true };
		const short = { ...s, lines: [], units: [{ ...hull, label: 'Jeugdwet' }] };
		const without = { ...s, lines: [], units: [{ ...hull, label: 'Jeugdwet', changed: false }] };
		const width = (o: Scene) => laneLayout(o, WIDTH).units.get(hull.id)!.label.width;
		expect(width(short)).toBeGreaterThan(width(without));
	});

	it('comes first on a phone and carries a name there', () => {
		const s = d2();
		const strips = laneStrips(s, 375);
		const at = (id: string) => strips.units.get(id)!;
		const changed = laws(s).filter((u) => u.changed);
		const others = laws(s).filter((u) => !u.changed && !u.focus);
		const lastChanged = Math.max(...changed.map((u) => at(u.id).y));
		for (const u of changed) expect(strips.named.has(u.id)).toBe(true);
		for (const u of others) expect(at(u.id).y).toBeGreaterThanOrEqual(lastChanged);
		expect(strips.heads).toEqual([]);
	});
});
