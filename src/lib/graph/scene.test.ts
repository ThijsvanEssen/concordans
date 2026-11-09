import { describe, expect, it } from 'vitest';
import { EXAMPLES, example, shuffled, type Example } from '$lib/test/lanes';
import { costOf } from './store/budget';
import { buildScene, sceneClusters, type Scene, type SceneUnit } from './scene';
import { GROUP_MIN } from './scene-groups';
import type { LineKind } from './line-kind';
import type { GraphEdge, GraphNode } from './types';

const scenes = new Map<Example, Scene>();
const scene = (name: Example): Scene => {
	if (!scenes.has(name)) scenes.set(name, buildScene(example(name)));
	return scenes.get(name)!;
};

const unit = (s: Scene, test: (u: SceneUnit) => boolean) => s.units.find(test);
const labelled = (s: Scene, label: string) => unit(s, (u) => u.label === label);
const rowCounts = (u: SceneUnit | undefined) =>
	Object.fromEntries((u?.rows ?? []).map((r) => [r.id, r.members.length]));
const groups = (s: Scene) =>
	s.units
		.filter((u) => u.shape === 'group')
		.map((u) => `${u.column} ${u.label}`)
		.sort();

describe('the scene of the five examples (round 3)', () => {
	it('d1: the dossier in its rows, its ministerie in Wie maakt', () => {
		const s = scene('d1');
		const hull = unit(s, (u) => u.id === 'dossiers/36702');
		expect(hull).toMatchObject({ shape: 'hull', column: 'papers', focus: true });
		expect(rowCounts(hull)).toEqual({
			bill: 18,
			letters: 1,
			activities: 13,
			amendments: 1,
			motions: 2,
			votes: 5
		});
		expect(labelled(s, 'VWS')).toMatchObject({ column: 'makers', lane: 'government' });
		expect(s.lines.map((l) => l.id)).toEqual(['dossiers/36702→ministries/vws']);
	});

	it('d2: who makes by function, the fracties and Kamerleden as groups, other dossiers counted', () => {
		const s = scene('d2');
		const role = (name: string) => {
			const u = unit(s, (x) => x.label.startsWith(name));
			return u && { lane: u.lane, role: u.role, chamber: u.chamber, gap: u.gap };
		};
		const minister = { lane: 'government', role: 'minister VWS', chamber: null, gap: false };
		expect(role('Fleur Agema')).toEqual(minister);
		expect(role('J.A. Bruijn')).toEqual(minister);
		expect(role('Mirjam Sterk')).toEqual(minister);
		// The function of T. de Graaf at the Raad van State is not in the data: a gap.
		expect(role('Thom de Graaf')).toEqual({
			lane: 'council',
			role: 'advies Raad van State',
			chamber: null,
			gap: true
		});
		expect(role('Mei Li Vos')).toEqual({
			lane: 'parliament',
			role: null,
			chamber: 'EK',
			gap: false
		});
		expect(role('E.M. Sjerp')).toEqual({
			lane: 'parliament',
			role: null,
			chamber: null,
			gap: true
		});
		expect(groups(s)).toEqual([
			'laws 4 europees en internationaal',
			'laws 8 wetten',
			'makers 16 fracties',
			'makers 4 kamerleden',
			'papers 16 stemmingen',
			'papers 8 stukken'
		]);
		// Two commissies VWS: twice in the data (a gap for lawgraph).
		expect(s.units.filter((u) => u.sort === 'commissies').map((u) => u.label)).toEqual([
			'VWS',
			'VWS'
		]);
	});

	it('d2: one line per pair, ending in the row of the procedure it comes from', () => {
		const s = scene('d2');
		const to = (from: string) => s.lines.find((l) => l.from === from && l.to === 'dossiers/36702');
		const fracties = unit(s, (u) => u.label === '16 fracties')!;
		const leden = unit(s, (u) => u.label === '4 kamerleden')!;
		expect(to(fracties.id)).toMatchObject({ toRow: 'votes' });
		expect(to(leden.id)).toMatchObject({ kind: 'submitter', toRow: 'motions' });
		const pairs = s.lines.map((l) => [l.from, l.to].sort().join(' '));
		expect(new Set(pairs).size).toBe(pairs.length);
	});

	it('jw: the Jeugdwet in a row per hoofdstuk, its stukken as one group', () => {
		const s = scene('jw');
		const law = unit(s, (u) => u.id === 'instruments/bwbr0034925');
		expect(law).toMatchObject({ shape: 'hull', column: 'laws', focus: true });
		expect(law?.rows.map((r) => r.label)).toEqual([
			'Hoofdstuk 1',
			'Hoofdstuk 1a',
			'Hoofdstuk 2',
			'Hoofdstuk 3',
			'Hoofdstuk 4',
			'Hoofdstuk 10',
			'Hoofdstuk 11',
			'Hoofdstuk 12'
		]);
		expect(law?.rows.reduce((n, r) => n + r.members.length, 0)).toBe(74);
		expect(groups(s)).toEqual(['papers 61 stukken']);
	});

	it('v1: the uitspraken by instantie, the Awb and the Wkkgz in Wetten', () => {
		const s = scene('v1');
		const focus = s.units.filter((u) => u.focus).map((u) => u.id);
		expect(focus).toEqual(['dossiers/36702', 'instruments/bwbr0023864']);
		expect(unit(s, (u) => u.id === 'instruments/bwbr0005537')).toMatchObject({
			label: 'Algemene wet bestuursrecht',
			column: 'laws'
		});
		// Cited by 30 uitspraken: she stands on her own, not in a group of wetten.
		expect(unit(s, (u) => u.id === 'instruments/bwbr0037173')?.shape).toBe('node');
		const rulings = s.units.filter((u) => u.sort === 'uitspraken' && u.shape === 'group');
		expect(rulings.map((u) => u.breakdown).sort()).toEqual([
			'rb 16, HR 7, RvS 4, hof 3',
			'rb 4, HR 2, RvS 1'
		]);
		expect(s.units.filter((u) => u.shape === 'hull' && u.column === 'papers').length).toBe(5);
	});

	it('v1: loose bronnen fold by the column of their target too', () => {
		const s = scene('v1');
		// Round 3 drew ±45 units; by one target alone it was 98.
		expect(s.units.length).toBe(50);
		const loose = s.units.filter((u) => u.shape === 'node' && u.column !== 'makers');
		expect(loose.map((u) => u.label).sort()).toEqual([
			'32402, Wet kwaliteit, klachten en geschillen zorg',
			'33684, Jeugdwet',
			'Raad van State 2019-12-24 / 201806610/1/A3',
			'Raad van State 2021-07-28 / 202003365/1/A2',
			'Rechtbank Midden-Nederland 2020-01-10 / AWB - 19 _ 608',
			'Richtlijn 1999/93/EG',
			'Richtlijn 2004/17/EG',
			'Richtlijn 2014/25/EU',
			'Richtlijn 2014/61/EU',
			'Verordening (EU) nr. 910/2014',
			'Wet kwaliteit, klachten en geschillen zorg'
		]);
		// Publicaties to several wetten: one group, its line to the wet most of them have.
		const stb = unit(s, (u) => u.label === '15 publicaties')!;
		expect(s.lines.filter((l) => l.from === stb.id || l.to === stb.id).length).toBe(1);
		expect(stb.elsewhere).toBeGreaterThan(0);
	});

	it('v2: the Cyberbeveiligingswet in its rows, four dossiers only through the procedure', () => {
		const s = scene('v2');
		expect(rowCounts(unit(s, (u) => u.id === 'dossiers/36764'))).toEqual({
			bill: 16,
			letters: 8,
			commitments: 7,
			activities: 30,
			amendments: 5,
			motions: 14,
			votes: 20
		});
		expect(unit(s, (u) => u.label.startsWith('Foort van Oosten'))).toMatchObject({
			lane: 'government',
			role: 'minister JenV'
		});
		expect(groups(s)).toContain('makers 4 fracties');
	});
});

describe.each(EXAMPLES)('the rules of the scene: %s', (name) => {
	it('is deterministic: the same bronnen in another order give the same scene', () => {
		const g = example(name);
		const again = buildScene({
			nodes: shuffled(g.nodes),
			edges: shuffled(g.edges, 3),
			chosen: [...g.chosen].reverse()
		});
		expect(again).toEqual(scene(name));
	});

	it('draws no bron twice', () => {
		const all = scene(name).units.flatMap((u) => u.members);
		expect(new Set(all).size).toBe(all.length);
	});

	it('has no unit without a line but the chosen ones', () => {
		const s = scene(name);
		const ends = new Set(s.lines.flatMap((l) => [l.from, l.to]));
		expect(s.units.filter((u) => !u.focus && !ends.has(u.id)).map((u) => u.id)).toEqual([]);
	});

	it('folds groups from GROUP_MIN bronnen, with one line: to their target', () => {
		const s = scene(name);
		for (const g of s.units.filter((u) => u.shape === 'group')) {
			expect(g.members.length).toBeGreaterThanOrEqual(GROUP_MIN);
			expect(s.lines.filter((l) => l.from === g.id || l.to === g.id).length).toBe(1);
		}
	});

	it('names only rows its hulls have', () => {
		const s = scene(name);
		const rows = new Map(s.units.map((u) => [u.id, new Set(u.rows.map((r) => r.id))]));
		for (const l of s.lines) {
			if (l.fromRow) expect(rows.get(l.from)?.has(l.fromRow)).toBe(true);
			if (l.toRow) expect(rows.get(l.to)?.has(l.toRow)).toBe(true);
		}
	});

	it('lets the budget count a group as one place', () => {
		const s = scene(name);
		const ids = s.units.flatMap((u) => u.members);
		const folded = s.units.filter((u) => u.shape === 'group');
		const saved = folded.reduce((n, u) => n + u.members.length - 1, 0);
		expect(costOf(ids, sceneClusters(s))).toBe(ids.length - saved);
	});
});

describe('Tonen and Relatie on the scene (B51)', () => {
	const g = example('v1');
	const all = new Set<LineKind>([
		'structural',
		'part',
		'change',
		'citation',
		'explanation',
		'submitter',
		'member',
		'led'
	]);

	it('every relation off: no lines, and the chosen bronnen alone', () => {
		const s = buildScene({ ...g, visibility: { hiddenKinds: new Set(), hiddenLines: all } });
		expect(s.lines).toEqual([]);
		expect(s.units.every((u) => u.focus)).toBe(true);
	});

	it('a lijnsoort off: no line of it, in no layer', () => {
		for (const kind of all) {
			const s = buildScene({
				...g,
				visibility: { hiddenKinds: new Set(), hiddenLines: new Set([kind]) }
			});
			expect(s.lines.filter((l) => l.kind === kind)).toEqual([]);
		}
	});

	it('Wetten off: no wet, no hull of one and none of its articles', () => {
		const s = buildScene({
			...g,
			visibility: { hiddenKinds: new Set(['wetten']), hiddenLines: new Set() }
		});
		const members = new Set(s.units.flatMap((u) => u.members));
		expect(s.units.filter((u) => u.sort === 'wetten')).toEqual([]);
		expect([...members].filter((id) => id.startsWith('articles/bwbr0005537'))).toEqual([]);
	});

	it('Dossiers off: no dossier hull, and none of the stukken in it', () => {
		const s = buildScene({
			...example('d2'),
			visibility: { hiddenKinds: new Set(['dossiers']), hiddenLines: new Set() }
		});
		expect(s.units.filter((u) => u.sort === 'dossiers')).toEqual([]);
		expect(s.units.flatMap((u) => u.members).filter((id) => id.startsWith('documents/'))).toEqual(
			expect.not.arrayContaining(['documents/ek_kst_36702_a'])
		);
	});

	it('a stuksoort off: no stuk of it', () => {
		const s = buildScene({
			...example('d2'),
			visibility: { hiddenKinds: new Set(['stuksoort:wetsvoorstellen']), hiddenLines: new Set() }
		});
		const kinds = s.units
			.flatMap((u) => u.members)
			.map((id) => example('d2').nodes.find((n) => n.id === id)?.raw?.props?.kind);
		expect(kinds).not.toContain('Voorstel van wet');
	});
});

describe('what the legend and Tonen read of the scene', () => {
	const wet = 'instruments/bwbr1';
	const stuk = (n: number) =>
		({
			id: `documents/d${n}`,
			key: `d${n}`,
			collection: 'documents',
			drawClass: 'document',
			label: `Stuk ${n}`,
			raw: { props: { dossier_number: '36164' } }
		}) as unknown as GraphNode;
	const nodes = [
		{ id: wet, key: 'bwbr1', collection: 'instruments', drawClass: 'instrument', label: 'Wet' },
		...[1, 2, 3, 4, 5].map(stuk)
	] as unknown as GraphNode[];
	const edge = (from: string, relation: string, status?: string) =>
		({ id: `${from}-${relation}`, source: from, target: wet, relation, status }) as GraphEdge;
	const edges = [1, 2, 3, 4, 5].flatMap((n) => [
		edge(`documents/d${n}`, 'AMENDS', 'voorgesteld'),
		edge(`documents/d${n}`, 'REFERS_TO')
	]);
	const hullOf = (s: Scene) => s.units.find((u) => u.id.startsWith('dossiers/'));

	it('holds every lijnsoort under the lines, also those a heavier line covers', () => {
		const s = buildScene({ nodes, edges, chosen: [wet] });
		expect(new Set(s.lines.map((l) => l.kind))).toEqual(new Set(['change']));
		expect(new Set(s.kinds.map((k) => k.kind))).toEqual(new Set(['change', 'citation']));
	});

	it('draws no dossier with Dossiers off: its stukken stay, loose', () => {
		expect(hullOf(buildScene({ nodes, edges, chosen: [wet] }))).toBeTruthy();
		const off = buildScene({
			nodes,
			edges,
			chosen: [wet],
			visibility: { hiddenKinds: new Set(['dossiers']), hiddenLines: new Set() }
		});
		expect(hullOf(off)).toBeUndefined();
		expect(off.units.flatMap((u) => u.members)).toContain('documents/d1');
	});
});
