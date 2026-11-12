// The entries into the Hoge Raad over every area of law (B144, the plane "Ingangen naar de Hoge
// Raad"), from the answer of `/api/judgments/routes`: the courts whose judgments it hears in
// cassation, each with the articles that open it; the cases it hears in first and only
// instance; the court it sends a case to after cassation. A step after one court alone
// (`after_tier`) is dashed: only in some cases. Pure: the page asks the answer.
import {
	VIEWS,
	addCourt,
	stageName,
	tierName,
	type AreaRoute,
	type CourtStep,
	type RouteStep,
	type Routes
} from './route';
import { joinAnd, lowerFirst } from '$lib/text/words';

const SUPREME = 'hoge_raad';
const CASSATION = 'Cassatie';
const FIRST = 'Eerste aanleg';

/** A court whose judgments the Hoge Raad hears: "Gerechtshoven", "hoger beroep", for "civiel en
 *  straf", by "cassatie"; `to` holds the articles that open it. */
type CassationEntry = {
	name: string;
	stage: string;
	areas: string;
	via: string;
	dashed: boolean;
	to: CourtStep;
};
/** The Hoge Raad by itself (`first`: in first and only instance) or the court after it (`out`):
 *  its name, the procedure, the areas and the articles. */
type CassationSide = { court: CourtStep; stage: string; areas: string };
export type CassationIntake = {
	into: CassationEntry[];
	first: CassationSide[];
	out: CassationSide[];
};

type Item = { step: RouteStep; gap: boolean; area: AreaRoute };
type Group = { key: string; order: number; items: Item[] };

/**
 * The entries into the Hoge Raad: the courts before it, the full lines first, each a court of a
 * view (civiel and straf together) and stage; an article the areas of an entry differ in names
 * its area ("art. 398 Rv (civiel)"). Empty where the answer names none.
 */
export function supremeEntries(routes: Routes): CassationIntake {
	const into = new Map<string, Group>();
	const first = new Map<string, Group>();
	const out = new Map<string, Group>();
	const add = (groups: Map<string, Group>, key: string, order: number, item: Item) => {
		let group = groups.get(key);
		if (!group) groups.set(key, (group = { key, order, items: [] }));
		group.items.push(item);
	};
	for (const area of routes.areas) {
		const view = VIEWS.findIndex((v) => v.areas.includes(area.area));
		// A gap as a step without articles: the court is there, its article not read.
		const gaps = area.gaps.map((g) => ({
			step: { ...g, after_tier: null, designations: [] } as unknown as RouteStep,
			gap: true
		}));
		const items = [...area.steps.map((step) => ({ step, gap: false })), ...gaps];
		for (const [i, { step, gap }] of items.entries()) {
			const item = { step, gap, area };
			const stage = stageName(step.procedures);
			if (step.after_tier === SUPREME) add(out, `${step.tier}|${stage}`, 0, item);
			else if (step.tier !== SUPREME) continue;
			else if (stage !== CASSATION) add(first, stage, 0, item);
			else {
				const from = before(area.steps.slice(0, i), step.after_tier);
				if (!from) continue;
				const key = `${view}|${from.tier}|${stageName(from.procedures)}`;
				add(into, key, (step.after_tier ? 100 : 0) + view, item);
			}
		}
	}
	return {
		into: [...into.values()].sort((a, b) => a.order - b.order).map(entryOf),
		first: [...first.values()].map(besideOf),
		out: [...out.values()].map(besideOf)
	};
}

/** The court whose judgments a cassation hears: the one `after_tier` names, of the latest stage
 *  (the CRvB in hoger beroep, not in first and only instance); else the court of the stage before
 *  the Hoge Raad. */
function before(steps: RouteStep[], after: string | null): RouteStep | undefined {
	return steps.findLast(
		(s) => !s.after_tier && (after ? s.tier === after : stageName(s.procedures) !== CASSATION)
	);
}

function entryOf(group: Group): CassationEntry {
	const [, tier, stage] = group.key.split('|');
	const { court } = besideOf(group);
	return {
		name: tierName(tier),
		stage: lowerFirst(stage),
		areas: areasOf(group),
		// Cassation of a judgment in first instance, past hoger beroep.
		via: stage === FIRST ? 'sprongcassatie' : 'cassatie',
		dashed: group.items.some((x) => x.step.after_tier),
		to: court
	};
}

/** The court of a group, its articles from every step: one an area alone gives names it. */
function besideOf(group: Group): CassationSide {
	const [{ step }] = group.items;
	const courts: CourtStep[] = [];
	const many = new Set(group.items.map((x) => x.area.area)).size > 1;
	for (const { step: s, gap, area } of group.items) {
		if (gap) courts[0] ??= { tier: s.tier, name: tierName(s.tier), articles: [], gap: true };
		else addCourt(courts, s, area, many);
	}
	const court = courts[0];
	// A gap beside articles read: those articles, never the gap filled.
	if (court.articles.length) court.gap = false;
	return { court, stage: stageName(step.procedures), areas: areasOf(group) };
}

/** "civiel en straf": the areas of a group, in their order. */
function areasOf(group: Group): string {
	return joinAnd([...new Set(group.items.map((x) => x.area.area))]);
}
