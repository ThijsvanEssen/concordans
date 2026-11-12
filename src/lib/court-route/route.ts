// The page Rechtsgang in words, from the answer of `/api/judgments/routes`: per view (civiel
// and straf together, belasting, bestuur) the stages of a case, each as rows "als … / anders":
// a court the Bevoegdheidsregeling bestuursrechtspraak names goes to the row of its chapter, the
// court of every other case to "anders"; each court with the article that gives it its say. A
// court whose article is not read in the source is a gap, shown as one. And the regeling by
// chapter, each article with the court it names. Pure: the page asks the answer.
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
	/** The court a case goes to after this one alone, not after the others of its stage (the
	 *  Hoge Raad after the Centrale Raad van Beroep, `after_tier`): a dashed line in the card,
	 *  not a stage. */
	then?: CourtStep & { stage: string };
};
/** A row of a stage: the courts of a case that meets its condition. `when` null: every case,
 *  in a stage of one row; "anders": every other case. A row without courts ends the route
 *  (`none`: "Geen beroep"), with the article that says so. */
export type Row = {
	when: string | null;
	cite: Cited | null;
	none: string | null;
	courts: CourtStep[];
};
type Stage = { name: string; rows: Row[] };
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

/** The article of the regeling that excepts a besluit from beroep (hoofdstuk 1). */
const EXCEPTED = 'bijlage 2 artikel 1';

/** The stage of a step by its first procedure: Eerste aanleg, Hoger beroep, Cassatie. */
const stageName = (procedures: string[]) => procedures[0] ?? 'Overig';

/** The name of a court by its tier: "Rechtbanken", "Hoge Raad"; of the Raad van State its
 *  Afdeling, the court of a route. */
const tierName = (tier: string) =>
	tier === 'raad_van_state'
		? 'Afdeling bestuursrechtspraak van de Raad van State'
		: (TIER_LABEL[tier as Tier] ?? tier);

/** The entries into the Hoge Raad of API 0.80.39 (sprongcassatie after the rechtbank, the Hoge
 *  Raad in first and only instance, the gerechtshof after verwijzing): built once that release
 *  is live (B144), left out until then. */
const later = (step: RouteStep) =>
	(step.after_tier != null && step.after_tier !== 'centrale_raad_van_beroep') ||
	step.procedures[0] === 'Eerste en enige aanleg';

/**
 * The stages of the route of a view in their order, each with its rows: a court the areas of
 * the view give different articles names each with its area ("art. 42 RO (civiel)"). A step
 * after one court alone (`after_tier`) is a line under that court.
 */
export function routeOf(view: AreaView, routes: Routes): Stage[] {
	const areas = routes.areas.filter((a) => view.areas.includes(a.area));
	const stages: Stage[] = [];
	const stageOf = (name: string) => {
		let s = stages.find((x) => x.name === name);
		if (!s) stages.push((s = { name, rows: [] }));
		return s;
	};
	const after: [RouteStep, AreaRoute][] = [];
	for (const area of areas) {
		for (const step of area.steps) {
			if (later(step)) continue;
			if (step.after_tier) {
				after.push([step, area]);
				continue;
			}
			const row = rowOf(stageOf(stageName(step.procedures)), chapterOf(routes, step));
			addCourt(row.courts, step, area, areas.length > 1);
		}
		for (const gap of area.gaps) {
			const row = rowOf(stageOf(stageName(gap.procedures)), null);
			if (!row.courts.some((c) => c.tier === gap.tier))
				row.courts.push({ tier: gap.tier, name: tierName(gap.tier), articles: [], gap: true });
		}
	}
	const courts = stages.flatMap((s) => s.rows.flatMap((r) => r.courts));
	for (const [step, area] of after) {
		// The court of the latest stage: the CRvB in hoger beroep, not in first and only instance.
		const before = courts.findLast((c) => c.tier === step.after_tier);
		if (!before) continue;
		const then = { tier: step.tier, name: tierName(step.tier), articles: [], gap: false };
		addCourt([then], step, area, false);
		before.then = { ...then, stage: stageName(step.procedures) };
	}
	if (view.areas.includes('bestuur')) excepted(stages[0], routes);
	for (const stage of stages) settle(stage);
	return stages;
}

/** The row of a stage for a condition, made where it is not yet. */
function rowOf(stage: Stage, when: string | null): Row {
	let row = stage.rows.find((r) => r.when === when);
	if (!row) stage.rows.push((row = { when, cite: null, none: null, courts: [] }));
	return row;
}

/** The condition of a court the regeling names: "als de rechter is aangewezen, hoofdstuk 2
 *  bijlage 2", by the chapter of its article; null for a court it names none of. */
function chapterOf(routes: Routes, step: RouteStep): string | null {
	const numbers = new Set(step.designations.map((d) => d.article_number));
	const chapter = routes.regeling.find((c) => c.articles.some((a) => numbers.has(a.number)));
	return chapter ? `als de rechter is aangewezen, ${chapter.label.toLowerCase()} bijlage 2` : null;
}

/** First of all the besluit the regeling excepts from beroep (hoofdstuk 1): no court. */
function excepted(stage: Stage | undefined, routes: Routes) {
	const article = routes.regeling.flatMap((c) => c.articles).find((a) => a.number === EXCEPTED);
	if (!stage || !article) return;
	stage.rows.unshift({
		when: 'als het besluit is uitgezonderd',
		cite: articleOfBasis({ bwb_id: 'BWBR0005537', article_number: article.number }),
		none: article.heading ?? 'Geen beroep',
		courts: []
	});
}

/** A stage of one row holds every case, whatever names its court; of more, the row without a
 *  condition is "anders", last. */
function settle(stage: Stage) {
	if (stage.rows.length === 1) stage.rows[0].when = null;
	const other = stage.rows.find((r) => r.when === null);
	if (!other || stage.rows.length === 1) return;
	other.when = 'anders';
	stage.rows = [...stage.rows.filter((r) => r !== other), other];
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

/** The arrow into a stage: "hoger beroep"; after a stage with an "anders" row, the court of
 *  that row alone: "hoger beroep, na de rechtbank". */
export function arrowInto(stage: Stage, before: Stage): string {
	const name = stage.name.toLowerCase();
	const other = before.rows.length > 1 ? before.rows.at(-1)?.courts[0] : undefined;
	return other ? `${name}, na de ${other.tier === 'rechtbank' ? 'rechtbank' : other.name}` : name;
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
