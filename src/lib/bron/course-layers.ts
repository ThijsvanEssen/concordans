// The Verloop of a judgment in words, from the answer of `/api/judgments/{ecli}/course`: the
// layers of the band's line and the steps of its list. Without the client: the band asks the
// course (verloop.ts), the first paint has it from the server ($lib/first-paint).
import type { Schema } from '$lib/api/types';
import { NOT_IN_DATA } from '$lib/text/coverage';
import { korteDatum, langeDatum } from '$lib/text/datum';
import { articleRef } from '$lib/text/bw';
import { capitalize, textOf } from '$lib/text/words';
import { inbound, outbound, type Layer } from './behoort-layer';
import type { BronRef } from './ref';
import { outcomeOf } from './outcome-words';

export type Course = Schema<'JudgmentCourseResponse'>;
export type CourseStep = Schema<'CourseStep'>;

export const EARLIER = outbound('APPEAL_OF', 'judgments');
export const LATER = inbound('APPEAL_OF', 'judgments');
/** The conclusie on a judgment, and the arrest a conclusie is for. */
export const CONCLUSION = inbound('ADVISES_ON', 'judgments');
export const ADVISED = outbound('ADVISES_ON', 'judgments');
/** The other edges of a course: the ruling that sent a case back, an earlier uitspraak of
 *  the same court in the same case. */
export const COURSE_BUCKETS = [
	outbound('REFERRED_BY', 'judgments'),
	inbound('REFERRED_BY', 'judgments'),
	outbound('CONTINUES', 'judgments'),
	inbound('CONTINUES', 'judgments')
];

/** The laws the API's list of articles names (`data/route_articles.json`), as cited. */
const LAW: Record<string, string> = { BWBR0001830: 'RO', BWBR0005537: 'Awb' };

const isConclusion = (s: CourseStep) => s.decision_kind === 'conclusie';

/** What a step is in the case: its procedure in the lawyer's word, else what the step after
 *  it calls it (the stub of an eerdere aanleg). */
export function stageOf(step: CourseStep, course: Course): string {
	if (isConclusion(step)) return 'Conclusie';
	const p = (step.procedure ?? '').toLowerCase();
	if (p.startsWith('eerste aanleg')) return 'Eerste aanleg';
	if (p.startsWith('hoger beroep')) return 'Hoger beroep';
	if (/^(cassatie|artikel 8(0a|1) ro)/.test(p)) return 'Cassatie';
	if (p.startsWith('verwijzing')) return 'Na verwijzing';
	if (step.procedure) return capitalize(step.procedure);
	const to = course.steps.flatMap((s) => s.links).find((l) => l.to === step.ecli)?.relation;
	if (to === 'REFERRED_BY') return 'Cassatie';
	if (to === 'CONTINUES') return 'Eerdere uitspraak';
	return 'Eerdere aanleg';
}

/** The court and date of a step: "Gerechtshof Den Haag 16 mei 2023". */
export const stepName = (step: CourseStep, format = korteDatum) =>
	[step.court_name ?? step.court_code ?? step.ecli ?? 'Onbekende instantie', format(step.date)]
		.filter(Boolean)
		.join(' ');

export const stepRef = (step: CourseStep): BronRef => ({ collection: 'judgments', key: step.key });

/** How a step ended, after its remedy where it is an appeal: `cassatie verworpen`. */
export function stepOutcome(step: CourseStep, course: Course): string | null {
	const a = stageOf(step, course);
	return outcomeOf(step.outcome, a === 'Cassatie' || a === 'Hoger beroep' ? a : null);
}

/** The article that gives the court its say, as cited and as a ref: "art. 60 RO". */
export function basisArticle(step: CourseStep): { naam: string; ref: BronRef } | null {
	const b = step.basis;
	if (!b) return null;
	const law = LAW[b.bwb_id];
	const number = articleRef(b.bwb_id, b.article_number);
	return {
		naam: law ? `${number} ${law}` : number,
		ref: {
			collection: 'articles',
			key: `${b.bwb_id}_${b.article_number}`.toLowerCase().replace(/[^a-z0-9]+/g, '_')
		}
	};
}

/** A decision the text names as the one appealed that the data lacks, as text:
 *  "Rechtbank Gelderland, 9 juli 2025, 24/6811". */
export const unresolvedName = (t: Record<string, unknown>) =>
	[
		capitalize(textOf(t.court) ?? ''),
		textOf(t.date) ? langeDatum(textOf(t.date)!) : null,
		textOf(t.case_number)
	]
		.filter(Boolean)
		.join(', ');

/**
 * The band's line: the instances of the case before and after this one, in their order, this
 * one in its place (`self` its words: "deze uitspraak", or for a translation its original as
 * a link); a decision the text names that the data lacks first, by its name. A conclusie is
 * left out (the line Conclusie bij and the status name it), unless it is this one. Empty when
 * the case has nothing besides this one.
 */
export function courseLayers(course: Course, self?: Layer): Layer[] {
	const layers: Layer[] = (course.unresolved ?? []).map((t) => ({
		soort: `Eerdere aanleg, ${NOT_IN_DATA}`,
		naam: unresolvedName(t)
	}));
	for (const step of course.steps) {
		if (step.current) {
			layers.push(
				self ?? {
					soort: 'Deze uitspraak',
					// Whole on a phone too: "deze" alone read as cut off (UX-toets B4).
					naam: isConclusion(step) ? 'deze conclusie' : 'deze uitspraak',
					huidig: true,
					...outcomeLayer(step, course)
				}
			);
		} else if (!isConclusion(step)) {
			layers.push({
				soort: step.loaded ? stageOf(step, course) : `${stageOf(step, course)}, ${NOT_IN_DATA}`,
				naam: stepName(step),
				ref: stepRef(step),
				...outcomeLayer(step, course)
			});
		}
	}
	return layers.length > 1 ? layers : [];
}

const outcomeLayer = (step: CourseStep, course: Course) => {
	const u = stepOutcome(step, course);
	return u ? { uitkomst: u } : {};
};

/** The ids of the other judgments of the case: Verbonden does not list them again. */
export const courseIds = (course: Course) =>
	course.steps.filter((s) => !s.current).map((s) => `judgments/${s.key}`);
