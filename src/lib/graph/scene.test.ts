import { describe, expect, it } from 'vitest';
import { EXAMPLES, example, shuffled, type Example } from '$lib/test/lanes';
import { costOf } from './store/budget';
import { buildScene, sceneClusters, type Scene, type SceneUnit } from './scene';
import { GROUP_MIN } from './scene-groups';
import type { LineKind } from './line-kind';

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
			'laws 7 wetten',
			'makers 16 fracties',
			'makers 4 kamerleden',
			'papers 16 stemmingen',
			'papers 6 stukken'
		]);
		// Two commissies VWS: twice in the data (a gap for lawgraph).
		expect(s.units.filter((u) => u.sort === 'commissies').map((u) => u.label)).toEqual([
			'VWS',
			'VWS'
		]);
		expect(s.counts.bridged).toEqual({ dossiers: 16, activiteiten: 1, stukken: 8 });
		expect(s.counts.unlinked).toEqual({});
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
		expect(groups(s)).toEqual(['papers 53 stukken']);
	});

	it('v1: the uitspraken by instantie, the Awb in the strip Algemene wetten', () => {
		const s = scene('v1');
		const focus = s.units.filter((u) => u.focus).map((u) => u.id);
		expect(focus).toEqual(['dossiers/36702', 'instruments/bwbr0023864']);
		expect(unit(s, (u) => u.id === 'instruments/bwbr0005537')).toMatchObject({
			label: 'Algemene wet bestuursrecht',
			general: true
		});
		// Round 3 drew the Wkkgz in Wetten, with "30 uitspraken, rb 16, HR 7, RvS 4, hof 3". By the
		// rule of the plan she is general too (no change or structural line to a chosen bron, 30
		// uitspraken only through her): the 18 that cite her alone go with her to the strip.
		expect(unit(s, (u) => u.id === 'instruments/bwbr0037173')?.general).toBe(true);
		const rulings = s.units.filter((u) => u.sort === 'uitspraken' && u.shape === 'group');
		expect(rulings.map((u) => [u.general, u.breakdown]).sort()).toEqual([
			[false, 'HR 6, rb 3, RvS 2, hof 1'],
			[true, 'rb 13, hof 2, RvS 2, HR 1'],
			[true, 'rb 3, HR 1']
		]);
		// Changed by a chosen stuk: never general.
		expect(unit(s, (u) => u.id === 'instruments/bwbr0023864')?.general).toBe(false);
		expect(s.units.filter((u) => u.shape === 'hull' && u.column === 'papers').length).toBe(5);
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
		expect(s.counts.bridged).toEqual({ dossiers: 4 });
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

	it('loses no bron: every one stands in a unit or in a count', () => {
		const s = scene(name);
		const inUnits = s.units.reduce((n, u) => n + u.members.length, 0);
		const counted = [...Object.values(s.counts.unlinked), ...Object.values(s.counts.bridged)];
		expect(inUnits + counted.reduce((n, c) => n + (c ?? 0), 0)).toBe(example(name).nodes.length);
		const all = s.units.flatMap((u) => u.members);
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
