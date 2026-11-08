// The line Verloop of a judgment in the band, from one answer of the API (`/course`, cached):
// the instances of its case in their order, the list per step when it is opened
// (CourseList); for a translation its original's; and the ids Verbonden leaves out.
import { getJudgmentCourse } from '$lib/api/judgments';
import { getNodeFirst } from '$lib/api/records';
import { ifExists } from '$lib/api/errors';
import type { Neighbor } from '$lib/api/nodes';
import { ecliKey, keyEcli } from '$lib/text/ecli';
import { textOf } from '$lib/text/words';
import { layerOf, type Regel } from './behoort-layer';
import { stepName, courseIds, courseLayers } from './course-layers';

/** The line Verloop: asked once the band is there, left out where the case has nothing
 *  besides this one. Where the course does not come, this one alone, marked incomplete. */
export function courseLine(props: Record<string, unknown>): Regel[] {
	const ecli = textOf(props.ecli);
	if (!ecli || textOf(props.translation_of)) return [];
	return [
		{
			id: 'verloop',
			label: 'Verloop',
			lagen: [{ soort: 'Deze uitspraak', naam: 'deze uitspraak', huidig: true }],
			course: ecli,
			laad: async () => courseLayers(await getJudgmentCourse(ecli))
		}
	];
}

/**
 * A translation the Rechtspraak published under its own ECLI has no instances of its own: it
 * names its original (`translation_of`, a source value), and the Verloop is the original's,
 * the original a link in its place (audit L4).
 */
export function translationLines(props: Record<string, unknown>): Regel[] {
	const original = textOf(props.translation_of);
	const key = original ? ecliKey(original) : null;
	if (!original || !key) return [];
	return [
		{
			id: 'vertaling',
			label: 'Vertaling van',
			lagen: [{ soort: 'Origineel', naam: original, ref: { collection: 'judgments', key } }],
			laad: async () => {
				const l = await ifExists(getNodeFirst('judgments', key));
				return l?.node
					? [layerOf({ ...l.node, collection: 'judgments' } as Neighbor, 'Origineel')]
					: [];
			}
		},
		{
			id: 'verloop',
			label: 'Verloop',
			lagen: [],
			course: original,
			laad: async () => {
				const course = await ifExists(getJudgmentCourse(original));
				if (!course) return [];
				const self = course.steps.find((s) => s.current);
				return courseLayers(course, {
					soort: 'Het origineel',
					naam: self ? stepName(self) : original,
					ref: { collection: 'judgments', key }
				});
			}
		}
	];
}

/**
 * The ids of the other judgments of a judgment's case, which its Verloop names: Verbonden
 * does not list them again (Thijs, 9 Oct). For a translation its original's, the original
 * included. The same cached answer as the band's line.
 */
export async function courseIdsOf(key: string): Promise<string[]> {
	const ecli = keyEcli(key);
	if (!ecli) return [];
	const course = await ifExists(getJudgmentCourse(ecli));
	if (course && course.steps.length > 1) return courseIds(course);
	const light = await ifExists(getNodeFirst('judgments', key));
	const original = textOf(
		(light?.node as { props?: Record<string, unknown> } | undefined)?.props?.translation_of
	);
	if (!original) return [];
	const theirs = await ifExists(getJudgmentCourse(original));
	return theirs ? [`judgments/${ecliKey(original)}`, ...courseIds(theirs)] : [];
}
