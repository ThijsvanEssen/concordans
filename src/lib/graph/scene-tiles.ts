// Many dossiers around one target: a hull each makes the canvas a long list of the same. From
// TILES_MIN on those dossiers stand as one unit of tiles, per period, with one line to the target.
// Each keeps its own hull as the Zijpaneel opens it (`periods`); a chosen dossier never folds.
import { filterGroupCount } from '$lib/verbonden/filter';
import { targetsOf } from './scene-groups';
import type { SceneLine, SceneUnit } from './scene';

/** Dossiers with one target stand as tiles from this many on. */
export const TILES_MIN = 6;

/** The dossiers of one period, the newest first. */
export type TilePeriod = { label: string; units: SceneUnit[] };

/** The decades that stand apart, the newest first: what is older is one period. */
const DECADES = [2020, 2010, 2000];

/** The period of a dossier by the day it starts on the canvas: a decade, the last one open. */
function periodOf(date: string | null): string {
	const year = Number(date?.slice(0, 4));
	if (!year) return 'Zonder datum';
	const from = DECADES.find((d) => year >= d);
	if (from === undefined) return `Voor ${DECADES.at(-1)}`;
	return from === DECADES[0] ? `Sinds ${from}` : `${from} tot ${from + 9}`;
}

const PERIOD_ORDER = [
	...DECADES.map((d, i) => (i === 0 ? `Sinds ${d}` : `${d} tot ${d + 9}`)),
	`Voor ${DECADES.at(-1)}`,
	'Zonder datum'
];

const newestFirst = (a: SceneUnit, b: SceneUnit) =>
	(b.date ?? '').localeCompare(a.date ?? '') || b.id.localeCompare(a.id);

/** The dossiers in periods, in the order of time; a period without a dossier stands nowhere. */
export function periodsOf(units: readonly SceneUnit[]): TilePeriod[] {
	return PERIOD_ORDER.flatMap((label) => {
		const here = units.filter((u) => periodOf(u.date) === label).sort(newestFirst);
		return here.length > 0 ? [{ label, units: here }] : [];
	});
}

function tilesUnit(target: string, parts: readonly SceneUnit[]): SceneUnit {
	return {
		...parts[0],
		id: `tiles:${target}`,
		shape: 'tiles',
		label: filterGroupCount(parts.length, 'dossiers'),
		members: parts.flatMap((u) => u.members).sort(),
		rows: [],
		periods: periodsOf(parts),
		date: parts.map((u) => u.date ?? '').sort()[0] || null
	};
}

type Folded = {
	units: SceneUnit[];
	unitOf: Map<string, string>;
	targetOf: Map<string, string>;
};

/** Folds the dossiers with one target into tiles, on top of the groups (`foldGroups`). */
export function foldTiles(folded: Folded, lines: readonly SceneLine[]): Folded {
	const targets = targetsOf(folded.units, lines);
	const byTarget = new Map<string, SceneUnit[]>();
	for (const u of folded.units) {
		const target = targets.get(u.id)?.id;
		if (!target || u.shape !== 'hull' || u.column !== 'papers' || u.focus || u.general) continue;
		byTarget.set(target, [...(byTarget.get(target) ?? []), u]);
	}
	const unitOf = new Map(folded.unitOf);
	const targetOf = new Map(folded.targetOf);
	const tiles: SceneUnit[] = [];
	const gone = new Set<string>();
	for (const [target, parts] of byTarget) {
		if (parts.length < TILES_MIN) continue;
		const unit = tilesUnit(target, parts);
		tiles.push(unit);
		targetOf.set(unit.id, target);
		for (const u of parts) {
			gone.add(u.id);
			unitOf.set(u.id, unit.id);
		}
	}
	return { units: [...folded.units.filter((u) => !gone.has(u.id)), ...tiles], unitOf, targetOf };
}
