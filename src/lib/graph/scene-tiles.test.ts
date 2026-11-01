import { describe, expect, it } from 'vitest';
import { laneLayout } from './lane-layout';
import { laneStrips } from './lane-strips';
import { buildScene } from './scene';
import { periodsOf, TILES_MIN } from './scene-tiles';
import type { GraphEdge, GraphNode } from './types';

const LAW = 'instruments/wet';

/** A stuk of a dossier that proposes to change the wet. */
function stuk(dossier: number, i: number, year: number): GraphNode {
	return {
		id: `documents/d${dossier}_${i}`,
		key: `d${dossier}_${i}`,
		collection: 'documents',
		drawClass: 'document',
		label: `Stuk ${i}`,
		raw: {
			props: { dossier_number: String(dossier), date: `${year}-03-01`, kind: 'Voorstel van wet' }
		}
	} as unknown as GraphNode;
}

function canvas(dossiers: number, stukken = 4) {
	const nodes: GraphNode[] = [
		{
			id: LAW,
			key: 'wet',
			collection: 'instruments',
			drawClass: 'instrument',
			label: 'Wet',
			raw: { props: {} }
		} as unknown as GraphNode
	];
	const edges: GraphEdge[] = [];
	for (let d = 0; d < dossiers; d++)
		for (let i = 0; i < stukken; i++) {
			const n = stuk(30000 + d, i, 2005 + d * 3);
			nodes.push(n);
			edges.push({
				id: `${n.id}>${LAW}`,
				source: n.id,
				target: LAW,
				relation: 'AMENDS',
				status: 'voorgesteld'
			} as unknown as GraphEdge);
		}
	return { nodes, edges, chosen: [LAW] };
}

describe('tiles', () => {
	it('folds many dossiers with one target into one unit with one line', () => {
		const scene = buildScene(canvas(TILES_MIN));
		const tiles = scene.units.filter((u) => u.shape === 'tiles');
		expect(tiles).toHaveLength(1);
		expect(tiles[0].label).toBe(`${TILES_MIN} dossiers`);
		expect(scene.units.filter((u) => u.shape === 'hull' && u.column === 'papers')).toEqual([]);
		expect(scene.lines.filter((l) => l.from === tiles[0].id || l.to === tiles[0].id)).toHaveLength(
			1
		);
	});
	it('leaves fewer dossiers as hulls', () => {
		const scene = buildScene(canvas(TILES_MIN - 1));
		expect(scene.units.some((u) => u.shape === 'tiles')).toBe(false);
	});
	it('never folds a chosen dossier', () => {
		const c = canvas(TILES_MIN + 1);
		const scene = buildScene({ ...c, chosen: [LAW, c.nodes[1].id] });
		expect(scene.units.find((u) => u.id === 'dossiers/30000')?.shape).toBe('hull');
		const tiles = scene.units.find((u) => u.shape === 'tiles')!;
		const inTiles = tiles.periods.flatMap((p) => p.units.map((u) => u.id));
		expect(inTiles).not.toContain('dossiers/30000');
	});
	it('puts every dossier in exactly one period, under its head, the newest period first', () => {
		const scene = buildScene(canvas(TILES_MIN + 2));
		const tiles = scene.units.find((u) => u.shape === 'tiles')!;
		const ids = tiles.periods.flatMap((p) => p.units.map((u) => u.id));
		expect(new Set(ids).size).toBe(TILES_MIN + 2);
		expect(tiles.periods.map((p) => p.label)).toEqual([
			'Sinds 2020',
			'2010 tot 2019',
			'2000 tot 2009'
		]);
		const box = laneLayout(scene, 1100).units.get(tiles.id)!;
		const places = box.rows.map((r) => r.id);
		for (const p of tiles.periods) {
			const head = places.indexOf(p.label);
			expect(head).toBeGreaterThanOrEqual(0);
			p.units.forEach((u, i) => expect(places[head + 1 + i]).toBe(u.id));
		}
	});
	it('gives each dossier a line of 24 px, inside the hull, on a wide screen and a phone', () => {
		const scene = buildScene(canvas(TILES_MIN + 2));
		const id = scene.units.find((u) => u.shape === 'tiles')!.id;
		for (const box of [
			laneLayout(scene, 1100).units.get(id)!,
			laneStrips(scene, 375).units.get(id)!
		]) {
			const tops = box.rows.filter((r) => r.id.startsWith('dossiers/')).map((r) => r.y);
			for (let i = 1; i < tops.length; i++)
				expect(tops[i] - tops[i - 1]).toBeGreaterThanOrEqual(24);
			expect(Math.max(...tops) + 12).toBeLessThanOrEqual(box.mark.y + box.mark.height);
		}
	});
	it('sets a dossier without a date apart', () => {
		const unit = (id: string, date: string | null) => ({ id, date }) as never;
		expect(periodsOf([unit('a', null), unit('b', '1999-01-01')]).map((p) => p.label)).toEqual([
			'Voor 2000',
			'Zonder datum'
		]);
	});
});
