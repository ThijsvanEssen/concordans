// The page Rechtsgang in words, from the answer of `/api/judgments/routes`: per view (civiel
// and straf together, belasting, bestuur) the stages of a case, each with its courts and the
// article that gives each its say; a court whose article is not read in the source is a gap,
// shown as one. And the Bevoegdheidsregeling bestuursrechtspraak by chapter, each article with
// the court it names. Pure: the page asks the answer.
import type { Schema } from '$lib/api/types';
import { articleOfBasis } from './basis';
import type { BronRef } from '$lib/bron/ref';
import { TIER_LABEL, type Tier } from '$lib/vocabulary';

export type Routes = Schema<'JudgmentRoutesResponse'>;
type AreaRoute = Schema<'AreaRoute'>;
type RouteStep = Schema<'RouteStep'>;

/** An article cited, with its readable address where it has one (`articleOfBasis`). */
export type Cited = { name: string; ref: BronRef; path: string | null; area?: string };
export type CourtStep = {
	tier: string;
	name: string;
	articles: Cited[];
	/** The article is not read in the source: shown as a gap, never filled. */
	gap: boolean;
};
type Stage = { name: string; courts: CourtStep[] };
type AreaView = {
	id: string;
	label: string;
	/** The label on a phone. */
	short: string;
	/** After "Rechtsgang", in the link under the Verloop. */
	within: string;
	areas: string[];
};

/** The views of the page, in the order of the choice. */
export const VIEWS: AreaView[] = [
	{
		id: 'civiel',
		label: 'Civiel recht en strafrecht',
		short: 'Civiel en straf',
		within: 'in het civiel recht en strafrecht',
		areas: ['civiel', 'straf']
	},
	{
		id: 'belasting',
		label: 'Belastingrecht',
		short: 'Belasting',
		within: 'in het belastingrecht',
		areas: ['belasting']
	},
	{
		id: 'bestuur',
		label: 'Bestuursrecht',
		short: 'Bestuur',
		within: 'in het bestuursrecht',
		areas: ['bestuur']
	}
];

/** The stage of a step by its first procedure: Eerste aanleg, Hoger beroep, Cassatie. */
const stageName = (procedures: string[]) => procedures[0] ?? 'Overig';

/** The name of a court by its tier: "Rechtbanken", "Hoge Raad"; of the Raad van State its
 *  Afdeling, the court of a route. */
const tierName = (tier: string) =>
	tier === 'raad_van_state'
		? 'Afdeling bestuursrechtspraak van de Raad van State'
		: (TIER_LABEL[tier as Tier] ?? tier);

/**
 * The stages of the route of a view in their order, each with its courts: a court the areas
 * of the view give different articles names each with its area ("art. 42 RO (civiel)"). A
 * court the route names by the regeling (`designations`) in a stage where the rechtbank is
 * too goes to `others`: the bijzondere bestuursrechter in first and only instance.
 */
export function routeOf(view: AreaView, routes: Routes): { stages: Stage[]; others: CourtStep[] } {
	const areas = routes.areas.filter((a) => view.areas.includes(a.area));
	const stages: Stage[] = [];
	const others: CourtStep[] = [];
	const stageOf = (name: string) => {
		let s = stages.find((x) => x.name === name);
		if (!s) stages.push((s = { name, courts: [] }));
		return s;
	};
	for (const area of areas) {
		for (const step of area.steps) {
			const stage = stageOf(stageName(step.procedures));
			const other =
				step.designations.length > 0 && stage.courts.some((c) => c.tier === 'rechtbank');
			addCourt(other ? others : stage.courts, step, area, areas.length > 1);
		}
		for (const gap of area.gaps) {
			const courts = stageOf(stageName(gap.procedures)).courts;
			if (!courts.some((c) => c.tier === gap.tier))
				courts.push({ tier: gap.tier, name: tierName(gap.tier), articles: [], gap: true });
		}
	}
	return { stages, others };
}

function addCourt(courts: CourtStep[], step: RouteStep, area: AreaRoute, many: boolean) {
	let court = courts.find((c) => c.tier === step.tier);
	if (!court)
		courts.push((court = { tier: step.tier, name: tierName(step.tier), articles: [], gap: false }));
	for (const b of [step.basis, ...step.designations]) {
		const cited = articleOfBasis(b);
		const same = court.articles.find((a) => a.name === cited.name);
		if (same) delete same.area;
		else court.articles.push(many ? { ...cited, area: area.area } : cited);
	}
}

/** The court an article of the regeling names, by the route's `designations`: "Centrale Raad
 *  van Beroep"; null for an article that names none of the route's courts. */
export function designatedCourt(routes: Routes, number: string): string | null {
	for (const area of routes.areas)
		for (const step of area.steps)
			if (step.designations.some((d) => d.article_number === number)) return tierName(step.tier);
	return null;
}

/** "Artikel 2" of "bijlage 2 artikel 2". */
export const annexArticleName = (number: string) =>
	`Artikel ${number.replace(/^bijlage \S+ artikel /, '')}`;
