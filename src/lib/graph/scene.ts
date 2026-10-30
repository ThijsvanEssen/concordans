// The scene of Omgeving as lanes: from the bronnen and edges of the canvas, the columns (Wie maakt,
// Kamerstukken, Wetten, Rechtspraak), the units in them (a bron, a hull with rows, a group drawn as
// a disc with its count) and one line per pair of units. Pure: the layout (lane-layout.ts) places
// it and the lines (lane-lines.ts) route it. The rules, from the design of round 3:
// - a dossier holds its bronnen in rows in the order of the procedure, a wet its articles per
//   hoofdstuk (scene-hulls.ts); who makes stands in three lanes by their function (roles.ts);
// - four bronnen or more of one soort with the same target, or a target in the same column, are
//   one group (scene-groups.ts);
// - a general wet (no change or structural line, more than twenty bronnen only through her) and
//   what hangs on her alone go to the strip Algemene wetten;
// - one line per pair of units: the heaviest relation, with the number of edges and the row it
//   ends in; no unit without a line to the chosen bronnen: the rest is counted below.
import { rubriekOfSort, sortOf, type Sort } from '$lib/bron/rubrieken';
import { textOf } from '$lib/text/words';
import { nodeId, RELATIONS, type Relation } from '$lib/vocabulary';
import { isDrawn } from './collection-role';
import { lineKindOf, type LineKind } from './line-kind';
import { isCouncilAdvice, makerRole, type MakerLane } from './roles';
import { foldGroups, markGeneral, unreached } from './scene-groups';
import {
	HULL_MIN,
	hullCandidates,
	hullLabel,
	isHullEdge,
	hullRows,
	type HullCandidate,
	type HullRow
} from './scene-hulls';
import { isVersionCollection, lawIdOf, type GraphEdge, type GraphNode } from './types';
import { SHOW_ALL, visibleGraph, type Visibility } from './visibility';

export type Column = 'makers' | 'papers' | 'laws' | 'rulings';

type UnitShape = 'node' | 'hull' | 'group';

export type SceneUnit = {
	/** A bron's id, a hull's container id, or `group:` and the id of its first member. */
	id: string;
	shape: UnitShape;
	column: Column;
	/** The lane in Wie maakt; null in the other columns. */
	lane: MakerLane | null;
	sort: Sort;
	label: string;
	/** The bronnen it stands for, sorted: one, a hull's container (when on the canvas) and members, a group's members. */
	members: string[];
	/** A hull's rows; empty for a bron or a group. */
	rows: HullRow[];
	/** The day it is placed by in Tijd: a bron's date, the first of a hull, the middle of a group. */
	date: string | null;
	/** It holds a chosen bron. */
	focus: boolean;
	/** It stands in the strip Algemene wetten. */
	general: boolean;
	/** In Wie maakt: the function on the day of the first stuk. */
	role: string | null;
	/** In Wie maakt: a Kamerlid's Kamer. */
	chamber: 'TK' | 'EK' | null;
	/** In Wie maakt: the data has no function for this person. */
	gap: boolean;
	/** A group of uitspraken by instantie: "rb 16, HR 7, RvS 4". */
	breakdown: string | null;
	/** A group: the other units its bronnen have a line with, not drawn (only to its target). */
	elsewhere: number;
};

export type SceneLine = {
	/** `from→to`. */
	id: string;
	from: string;
	to: string;
	/** The heaviest relation between the two, and its lijnsoort. */
	relation: Relation;
	kind: LineKind;
	/** A change that is only proposed (`voorgesteld`). */
	proposed: boolean;
	/** How many edges the line stands for: its width. */
	count: number;
	/** The row of the hull the line leaves from or ends in, where that end is a hull. */
	fromRow: string | null;
	toRow: string | null;
};

export type SceneCounts = {
	/** Bronnen without a line to the chosen ones, by soort: one count below the canvas. */
	unlinked: Partial<Record<Sort, number>>;
	/** Of those, the ones only met through an activity about several dossiers, by soort. */
	bridged: Partial<Record<Sort, number>>;
};

export type Scene = { units: SceneUnit[]; lines: SceneLine[]; counts: SceneCounts };

type SceneInput = {
	nodes: readonly GraphNode[];
	edges: readonly GraphEdge[];
	/** The chosen bronnen (or the focus): they and their units always stay. */
	chosen: readonly string[];
	visibility?: Visibility;
};

const RUBRIEK_COLUMN = {
	wetten: 'laws',
	rechtspraak: 'rulings',
	kamerstukken: 'papers',
	parlement: 'makers',
	regering: 'makers'
} as const satisfies Record<string, Column>;

/** The column of a soort; the activiteiten of the Kamer stand with the Kamerstukken. */
const columnOfSort = (sort: Sort): Column =>
	sort === 'activiteiten' ? 'papers' : RUBRIEK_COLUMN[rubriekOfSort(sort)];

const dayOf = (node: GraphNode | undefined): string | null =>
	textOf(node?.raw?.props?.date)?.slice(0, 10) ?? null;

const blank = (
	id: string,
	shape: UnitShape,
	sort: Sort,
	label: string
): Omit<SceneUnit, 'members'> & { members: string[] } => ({
	id,
	shape,
	column: columnOfSort(sort),
	lane: null,
	sort,
	label,
	members: [],
	rows: [],
	date: null,
	focus: false,
	general: false,
	role: null,
	chamber: null,
	gap: false,
	breakdown: null,
	elsewhere: 0
});

const holdsChosen = (c: HullCandidate, chosen: ReadonlySet<string>) =>
	chosen.has(c.id) || c.members.some((m) => chosen.has(m.id));

/**
 * Which candidates stand as a hull: a wet with two articles on the canvas or a chosen one, a dossier
 * from HULL_MIN bronnen on or a chosen one. A wet with one article stands as one bron.
 */
const stands = (c: HullCandidate, chosen: ReadonlySet<string>) =>
	c.kind === 'law'
		? c.members.length > 1 || (c.members.length === 1 && holdsChosen(c, chosen))
		: c.members.length >= HULL_MIN || holdsChosen(c, chosen);

/** The home of each bron: of its standing hulls the chosen one, else the fullest, else the first. */
function placeInHulls(
	homes: ReadonlyMap<string, string[]>,
	hulls: ReadonlyMap<string, HullCandidate>,
	chosen: ReadonlySet<string>
): Map<string, string> {
	const home = new Map<string, string>();
	const size = (id: string) => hulls.get(id)?.members.length ?? 0;
	for (const [bron, ids] of homes) {
		const standing = ids.filter((id) => hulls.has(id));
		const pick = [...standing].sort(
			(a, b) =>
				Number(chosen.has(b)) - Number(chosen.has(a)) || size(b) - size(a) || a.localeCompare(b)
		)[0];
		if (pick) home.set(bron, pick);
	}
	return home;
}

/** The soort of a hull: its container's, else a dossier, or a wet read from its articles. */
function hullSort(c: HullCandidate): Sort {
	if (c.container) return sortOf(c.container.collection, c.container.key, c.container.raw?.props);
	if (c.kind === 'dossier') return 'dossiers';
	const props = c.members[0]?.raw?.props;
	return sortOf('instruments', lawIdOf(props) ?? '', props);
}

function hullUnit(c: HullCandidate, members: GraphNode[]): SceneUnit {
	const dates = members
		.map(dayOf)
		.filter((d): d is string => !!d)
		.sort();
	return {
		...blank(c.id, 'hull', hullSort(c), hullLabel(c)),
		members: [...(c.container ? [c.id] : []), ...members.map((m) => m.id)].sort(),
		rows: hullRows(c.kind, members),
		date: dates[0] ?? dayOf(c.container)
	};
}

/** A wet with one article on the canvas: one bron, by the wet's name, standing for both. */
function smallLaw(c: HullCandidate, article: GraphNode): SceneUnit {
	return {
		...blank(c.id, 'node', hullSort(c), hullLabel(c)),
		members: [article.id, ...(c.container ? [c.id] : [])].sort(),
		date: dayOf(c.container) ?? dayOf(article)
	};
}

/** The first day each person signed a stuk on the canvas, and who signed an advies of the RvS. */
function signatures(nodes: ReadonlyMap<string, GraphNode>, edges: readonly GraphEdge[]) {
	const first = new Map<string, string>();
	const council = new Set<string>();
	for (const e of edges) {
		const from = nodes.get(e.source);
		const to = nodes.get(e.target);
		if (
			from?.collection !== 'members' ||
			!to ||
			lineKindOf(e.relation, from.drawClass) !== 'submitter'
		)
			continue;
		const day = dayOf(to);
		if (day && (!first.has(from.id) || day < first.get(from.id)!)) first.set(from.id, day);
		if (isCouncilAdvice(textOf(to.raw?.props?.kind))) council.add(from.id);
	}
	return { first, council };
}

function nodeUnit(
	node: GraphNode,
	signed: ReturnType<typeof signatures>,
	ministryName: (key: string) => string
): SceneUnit {
	const unit: SceneUnit = {
		...blank(node.id, 'node', sortOf(node.collection, node.key, node.raw?.props), node.label),
		members: [node.id],
		date: dayOf(node)
	};
	if (unit.column !== 'makers') return unit;
	const role = makerRole(node, {
		firstDay: signed.first.get(node.id) ?? null,
		council: signed.council.has(node.id),
		ministryName
	});
	const person = node.collection === 'members' && role.lane !== 'council';
	const sort = !person ? unit.sort : role.lane === 'government' ? 'bewindspersonen' : 'kamerleden';
	return { ...unit, ...role, sort };
}

/** The units before grouping: each standing hull, and each bron not in one. */
function baseUnits(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	chosen: ReadonlySet<string>
): { units: SceneUnit[]; unitOf: Map<string, string>; home: Map<string, string> } {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const { candidates, homes } = hullCandidates(nodes, edges);
	const hulls = new Map([...candidates].filter(([, c]) => stands(c, chosen)));
	const home = placeInHulls(homes, hulls, chosen);
	const units: SceneUnit[] = [];
	const unitOf = new Map<string, string>();
	for (const c of hulls.values()) {
		const members = c.members.filter((m) => home.get(m.id) === c.id);
		units.push(hullUnit(c, members));
		for (const id of [c.id, ...members.map((m) => m.id)]) unitOf.set(id, c.id);
	}
	for (const c of candidates.values()) {
		if (c.kind !== 'law' || c.members.length !== 1 || hulls.has(c.id)) continue;
		units.push(smallLaw(c, c.members[0]));
		for (const id of [c.id, c.members[0].id]) unitOf.set(id, c.id);
	}
	const signed = signatures(byId, edges);
	const ministryName = (key: string) =>
		textOf(byId.get(nodeId('ministries', key))?.raw?.props?.abbreviation) ?? key.toUpperCase();
	for (const node of nodes) {
		if (unitOf.has(node.id)) continue;
		units.push(nodeUnit(node, signed, ministryName));
		unitOf.set(node.id, node.id);
	}
	for (const u of units) u.focus = u.members.some((m) => chosen.has(m));
	return { units, unitOf, home };
}

type UnitEdge = { edge: GraphEdge; from: string; to: string; fromClass: GraphNode['drawClass'] };

type Pair = { count: number; best: UnitEdge; rows: Map<string, Map<string, number>> };

const weightOf = (e: GraphEdge) => RELATIONS[e.relation]?.weight ?? 0;

/** Above zero when `a` is the heavier edge; the relation's name and the id break a tie. */
const heavier = (a: GraphEdge, b: GraphEdge) =>
	weightOf(a) - weightOf(b) || b.relation.localeCompare(a.relation) || b.id.localeCompare(a.id);

/** The row of a hull most edges of a pair start or end in; the earlier row on a tie. */
function mostRow(
	unit: SceneUnit | undefined,
	rows: Map<string, number> | undefined
): string | null {
	if (!unit || !rows) return null;
	const order = (row: string) => unit.rows.findIndex((r) => r.id === row);
	return [...rows].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))[0]?.[0] ?? null;
}

function addEdge(pair: Pair, e: UnitEdge, rowOf: ReadonlyMap<string, string>) {
	pair.count += 1;
	if (heavier(e.edge, pair.best.edge) > 0) pair.best = e;
	for (const [unit, bron] of [
		[e.from, e.edge.source],
		[e.to, e.edge.target]
	]) {
		const row = rowOf.get(bron);
		if (!row) continue;
		const rows = pair.rows.get(unit) ?? new Map<string, number>();
		pair.rows.set(unit, rows.set(row, (rows.get(row) ?? 0) + 1));
	}
}

/**
 * One line per pair of units: the heaviest relation decides the direction and the lijnsoort, the
 * edges between them its width, the rows the most of them start or end in its rows.
 */
function linesBetween(units: readonly SceneUnit[], edges: readonly UnitEdge[]): SceneLine[] {
	const rowOf = new Map<string, string>();
	for (const u of units) for (const r of u.rows) for (const m of r.members) rowOf.set(m, r.id);
	const byId = new Map(units.map((u) => [u.id, u]));
	const pairs = new Map<string, Pair>();
	for (const e of edges) {
		const key = [e.from, e.to].sort().join(' ');
		const pair = pairs.get(key) ?? { count: 0, best: e, rows: new Map() };
		addEdge(pair, e, rowOf);
		pairs.set(key, pair);
	}
	return [...pairs.values()]
		.map(({ best, count, rows }) => ({
			id: `${best.from}→${best.to}`,
			from: best.from,
			to: best.to,
			relation: best.edge.relation,
			kind: lineKindOf(best.edge.relation, best.fromClass),
			proposed: best.edge.status === 'voorgesteld',
			count,
			fromRow: mostRow(byId.get(best.from), rows.get(best.from)),
			toRow: mostRow(byId.get(best.to), rows.get(best.to))
		}))
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** Who makes: the commissie that led a meeting about several dossiers still has its line to it. */
const isMaker = (n: GraphNode) =>
	columnOfSort(sortOf(n.collection, n.key, n.raw?.props)) === 'makers';

/**
 * The bronnen in a hull that are about other dossiers too (an activity about several dossiers): a
 * bridge.
 */
function bridgesOf(
	nodes: ReadonlyMap<string, GraphNode>,
	edges: readonly GraphEdge[],
	home: ReadonlyMap<string, string>
): Set<string> {
	const out = new Set<string>();
	for (const e of edges)
		if (
			home.has(e.source) &&
			home.get(e.source) !== e.target &&
			isHullEdge(nodes.get(e.source), nodes.get(e.target), e.relation)
		)
			out.add(e.source);
	return out;
}

/**
 * The edges that may draw a line, by unit. An edge into a hull is no line; nor is one of a bridge
 * to a bron outside its hull draw no line either, but to who makes: that bron is only met
 * through the bridge (`bridged`).
 */
function unitEdges(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	unitOf: ReadonlyMap<string, string>,
	home: ReadonlyMap<string, string>
) {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const bridges = bridgesOf(byId, edges, home);
	const bridged = new Set<string>();
	const out: UnitEdge[] = [];
	for (const edge of edges) {
		const a = byId.get(edge.source);
		const b = byId.get(edge.target);
		if (!a || !b || !isDrawn(edge.relation)) continue;
		const from = unitOf.get(a.id);
		const to = unitOf.get(b.id);
		if (!from || !to || from === to) continue;
		const other = bridges.has(a.id) ? b : bridges.has(b.id) ? a : null;
		if (other && !isMaker(other)) {
			bridged.add(other === a ? from : to);
			continue;
		}
		if (!(isHullEdge(a, b, edge.relation) && home.has(a.id)))
			out.push({ edge, from, to, fromClass: a.drawClass });
	}
	return { edges: out, bridged };
}

/** The scene of a canvas. Deterministic: the same bronnen and edges in any order give the same scene. */
export function buildScene(input: SceneInput): Scene {
	const drawn = input.nodes.filter((n) => !isVersionCollection(n.collection));
	const { nodes, edges } = visibleGraph(drawn, input.edges, input.visibility ?? SHOW_ALL);
	const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
	const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
	const chosen = new Set(input.chosen);
	const base = baseUnits(sortedNodes, sortedEdges, chosen);
	const linked = unitEdges(sortedNodes, sortedEdges, base.unitOf, base.home);
	const general = markGeneral(base.units, linesBetween(base.units, linked.edges));
	const folded = foldGroups(general, linesBetween(general, linked.edges), sortedNodes);
	const lines = linesBetween(folded.units, groupEdges(linked.edges, folded));
	return unreached(
		withElsewhere(folded.units, linked.edges, folded),
		lines,
		linked.bridged,
		sortedNodes
	);
}

type Folded = ReturnType<typeof foldGroups>;

const unitIn = (folded: Folded, id: string) => folded.unitOf.get(id) ?? id;

/** The edges by their units after grouping: a group keeps only those to its target. */
function groupEdges(edges: readonly UnitEdge[], folded: Folded): UnitEdge[] {
	const keeps = (unit: string, other: string) =>
		!folded.targetOf.has(unit) || unitIn(folded, folded.targetOf.get(unit)!) === other;
	return edges
		.map((e) => ({ ...e, from: unitIn(folded, e.from), to: unitIn(folded, e.to) }))
		.filter((e) => e.from !== e.to && keeps(e.from, e.to) && keeps(e.to, e.from));
}

/** How many other units a group's bronnen have a line with, besides its target. */
function withElsewhere(
	units: SceneUnit[],
	edges: readonly UnitEdge[],
	folded: Folded
): SceneUnit[] {
	const others = new Map<string, Set<string>>();
	for (const e of edges)
		for (const [self, other] of [
			[unitIn(folded, e.from), unitIn(folded, e.to)],
			[unitIn(folded, e.to), unitIn(folded, e.from)]
		]) {
			const target = folded.targetOf.get(self);
			if (target === undefined || self === other || unitIn(folded, target) === other) continue;
			others.set(self, (others.get(self) ?? new Set()).add(other));
		}
	return units.map((u) => (others.has(u.id) ? { ...u, elsewhere: others.get(u.id)!.size } : u));
}

/** The groups of a scene as the budget counts them: a group drawn as one costs one place. */
export const sceneClusters = (scene: Scene): { id: string; members: string[] }[] =>
	scene.units.filter((u) => u.shape === 'group').map((u) => ({ id: u.id, members: u.members }));
