// The folding rules of the scene (scene.ts): general wetten to their strip, four bronnen or more of
// one soort with the same target (or one in the same column) into one group, and what has no line
// to the chosen bronnen into one count below the canvas. Each takes units and lines and returns new ones.
import { sortOf } from '$lib/bron/rubrieken';
import { textOf } from '$lib/text/words';
import { RELATIONS } from '$lib/vocabulary';
import { filterGroupCount } from '$lib/verbonden/filter';
import type { LineKind } from './line-kind';
import type { Column, Scene, SceneCounts, SceneLine, SceneUnit } from './scene';
import type { GraphNode } from './types';

/** Bronnen of one soort with the same lines are one group from this many on. */
export const GROUP_MIN = 4;

/** A wet is general when more bronnen than this stand on the canvas only through her. */
const GENERAL_MIN = 20;

/** A line of these kinds to a chosen unit ties a wet to it: she is then never general. */
const BINDING: ReadonlySet<LineKind> = new Set(['change', 'structural']);

/** The units each unit has a line with. */
function partnersOf(lines: readonly SceneLine[]): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	const add = (a: string, b: string) => out.set(a, (out.get(a) ?? new Set()).add(b));
	for (const l of lines) {
		add(l.from, l.to);
		add(l.to, l.from);
	}
	return out;
}

/**
 * The general wetten and what hangs on them alone, marked for the strip Algemene wetten: a wet
 * that is not chosen, has no change or structural line to a chosen unit, and more than GENERAL_MIN
 * bronnen with a line to her alone.
 */
export function markGeneral(units: readonly SceneUnit[], lines: readonly SceneLine[]): SceneUnit[] {
	const partners = partnersOf(lines);
	const chosen = new Set(units.filter((u) => u.focus).map((u) => u.id));
	const bound = new Set(
		lines
			.filter((l) => BINDING.has(l.kind) && (chosen.has(l.from) || chosen.has(l.to)))
			.flatMap((l) => [l.from, l.to])
	);
	const general = new Set<string>();
	for (const law of units) {
		if (law.column !== 'laws' || law.focus || bound.has(law.id)) continue;
		const alone = units.filter((u) => {
			const p = partners.get(u.id);
			return !u.focus && p?.size === 1 && p.has(law.id);
		});
		if (alone.reduce((n, u) => n + u.members.length, 0) <= GENERAL_MIN) continue;
		general.add(law.id);
		for (const u of alone) general.add(u.id);
	}
	return units.map((u) => (general.has(u.id) ? { ...u, general: true } : u));
}

/** Above zero when line `a` says more of a unit than `b`: to a chosen unit, heavier, more edges. */
function closer(a: SceneLine, b: SceneLine, otherA: SceneUnit, otherB: SceneUnit): number {
	const weight = (l: SceneLine) => RELATIONS[l.relation]?.weight ?? 0;
	return (
		Number(otherA.focus) - Number(otherB.focus) ||
		weight(a) - weight(b) ||
		a.count - b.count ||
		otherB.id.localeCompare(otherA.id)
	);
}

/** A unit's target, its column, and the row and lijnsoort its line ends in (`exact`). */
type Target = { id: string; column: Column; exact: string };

/**
 * The target of each unit: the unit at the other end of its main line (to a chosen unit first,
 * then the heaviest relation). A line between two makers (a seat in a fractie) is no target: four
 * Kamerleden who signed the moties of one dossier are one group, whatever their fractie.
 */
function targetsOf(units: readonly SceneUnit[], lines: readonly SceneLine[]): Map<string, Target> {
	const byId = new Map(units.map((u) => [u.id, u]));
	const best = new Map<string, { line: SceneLine; other: SceneUnit; row: string | null }>();
	for (const l of lines) {
		if (byId.get(l.from)?.column === 'makers' && byId.get(l.to)?.column === 'makers') continue;
		for (const [self, other, row] of [
			[l.from, l.to, l.toRow],
			[l.to, l.from, l.fromRow]
		] as const) {
			const o = byId.get(other);
			const now = best.get(self);
			if (o && (!now || closer(l, now.line, o, now.other) > 0))
				best.set(self, { line: l, other: o, row });
		}
	}
	return new Map(
		[...best].map(([id, { other, row, line }]) => [
			id,
			{ id: other.id, column: other.column, exact: `${other.id}#${row ?? ''}#${line.kind}` }
		])
	);
}

/** An uitspraak's instantie as a group counts it: rb, hof, HR, RvS, CRvB, CBb. */
function courtOf(node: GraphNode | undefined): string {
	const code = textOf(node?.raw?.props?.court_code) ?? '';
	if (/^RB/.test(code)) return 'rb';
	if (/^GH/.test(code)) return 'hof';
	if (code === 'HR' || code === 'PHR') return 'HR';
	const fixed: Record<string, string> = { RVS: 'RvS', CRVB: 'CRvB', CBB: 'CBb' };
	return fixed[code] ?? textOf(node?.raw?.props?.court) ?? 'overig';
}

/** "rb 16, HR 7, RvS 4": the most first, then by name. */
function breakdownOf(members: readonly string[], byId: ReadonlyMap<string, GraphNode>): string {
	const counts = new Map<string, number>();
	for (const id of members)
		counts.set(courtOf(byId.get(id)), (counts.get(courtOf(byId.get(id))) ?? 0) + 1);
	return [...counts]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([court, n]) => `${court} ${n}`)
		.join(', ');
}

function groupUnit(parts: readonly SceneUnit[], byId: ReadonlyMap<string, GraphNode>): SceneUnit {
	const members = parts.flatMap((u) => u.members).sort();
	const dates = parts
		.map((u) => u.date)
		.filter((d): d is string => !!d)
		.sort();
	const first = parts[0];
	return {
		...first,
		id: `group:${members[0]}`,
		shape: 'group',
		label: filterGroupCount(members.length, first.sort),
		members,
		date: dates[Math.floor(dates.length / 2)] ?? null,
		role: null,
		chamber: first.chamber,
		gap: parts.some((u) => u.gap),
		breakdown: first.sort === 'uitspraken' ? breakdownOf(members, byId) : null
	};
}

/** Units by key, the ones with a key only; a chosen bron and a hull never fold. */
function byKeyOf(
	units: readonly SceneUnit[],
	keyOf: (u: SceneUnit) => string | null
): Map<string, SceneUnit[]> {
	const out = new Map<string, SceneUnit[]>();
	for (const u of units) {
		const key = u.shape === 'node' && !u.focus ? keyOf(u) : null;
		if (key !== null) out.set(key, [...(out.get(key) ?? []), u]);
	}
	return out;
}

/** The target most of a group's parts have; the first by id on a tie. */
function commonTarget(parts: readonly SceneUnit[], targets: ReadonlyMap<string, Target>): string {
	const counts = new Map<string, number>();
	for (const u of parts) {
		const id = targets.get(u.id)!.id;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/**
 * Bronnen of one soort, lane and strip with the same target (`targetsOf`), GROUP_MIN or more, as
 * one group. Of what is left, those of one soort, lane and strip with a target in the same column
 * fold too. A group keeps one line: to the target most of its bronnen have. What else its bronnen
 * have a line with only counts (`elsewhere`). In Wie maakt a name says who did what: there only
 * makers of one Kamer with the same target, row and lijnsoort fold.
 */
export function foldGroups(
	units: readonly SceneUnit[],
	lines: readonly SceneLine[],
	nodes: readonly GraphNode[]
): { units: SceneUnit[]; unitOf: Map<string, string>; targetOf: Map<string, string> } {
	const targets = targetsOf(units, lines);
	const base = (u: SceneUnit) => [u.sort, u.lane ?? '', u.chamber ?? '', u.general].join('|');
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const unitOf = new Map<string, string>();
	const targetOf = new Map<string, string>();
	const groups: SceneUnit[] = [];
	const fold = (keyOf: (t: Target, maker: boolean) => string | null) => {
		const free = units.filter((u) => !unitOf.has(u.id));
		const byKey = byKeyOf(free, (u) => {
			const t = targets.get(u.id);
			const key = t && keyOf(t, u.column === 'makers');
			return key ? `${base(u)}|${key}` : null;
		});
		for (const parts of byKey.values()) {
			if (parts.length < GROUP_MIN) continue;
			const group = groupUnit(parts, byId);
			groups.push(group);
			targetOf.set(group.id, commonTarget(parts, targets));
			for (const u of parts) unitOf.set(u.id, group.id);
		}
	};
	fold((t, maker) => (maker ? t.exact : t.id));
	fold((t, maker) => (maker ? null : t.column));
	return { units: [...units.filter((u) => !unitOf.has(u.id)), ...groups], unitOf, targetOf };
}

/**
 * The units a line path joins to a chosen unit; without a chosen one, every unit with a line. Who
 * makes ends a path: a stemming only met through the fracties that cast it is not joined.
 */
function reachedFrom(units: readonly SceneUnit[], lines: readonly SceneLine[]): Set<string> {
	const partners = partnersOf(lines);
	const start = units.filter((u) => u.focus).map((u) => u.id);
	if (start.length === 0) return new Set(partners.keys());
	const maker = new Set(units.filter((u) => u.column === 'makers').map((u) => u.id));
	const seen = new Set(start);
	const queue = [...start];
	while (queue.length > 0) {
		const id = queue.shift()!;
		if (maker.has(id) && !start.includes(id)) continue;
		for (const next of partners.get(id) ?? [])
			if (!seen.has(next)) {
				seen.add(next);
				queue.push(next);
			}
	}
	return seen;
}

/**
 * No unit without a line to the chosen bronnen: the rest is counted by soort, what was only met
 * through an activity about several dossiers apart.
 */
export function unreached(
	units: readonly SceneUnit[],
	lines: readonly SceneLine[],
	bridged: ReadonlySet<string>,
	nodes: readonly GraphNode[]
): Scene {
	const reached = reachedFrom(units, lines);
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const counts: SceneCounts = { unlinked: {}, bridged: {} };
	for (const u of units) {
		if (reached.has(u.id)) continue;
		const tally =
			u.members.some((m) => bridged.has(m)) || bridged.has(u.id) ? counts.bridged : counts.unlinked;
		for (const id of u.members) {
			const n = byId.get(id);
			const sort = n ? sortOf(n.collection, n.key, n.raw?.props) : u.sort;
			tally[sort] = (tally[sort] ?? 0) + 1;
		}
	}
	return {
		units: units.filter((u) => reached.has(u.id)).sort((a, b) => a.id.localeCompare(b.id)),
		lines: lines.filter((l) => reached.has(l.from) && reached.has(l.to)),
		counts
	};
}
