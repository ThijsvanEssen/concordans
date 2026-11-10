// The article of law that gives a court its say, from the API's list (`data/route_articles.json`):
// as cited, as a ref and by its readable address. For the Verloop of a judgment (CourseList) and
// Rechtsgang. Apart from course-layers, which the first paint bundles without SvelteKit.
import type { Schema } from '$lib/api/types';
import { padHref } from '$lib/bron/address';
import type { CourseStep } from '$lib/bron/course-layers';
import type { BronRef } from '$lib/bron/ref';
import { articleRef, bookNumber } from '$lib/text/bw';

export type Basis = Schema<'CourseBasis'>;

/** The laws the API's list of articles names (`data/route_articles.json`), as cited. */
const LAW: Record<string, string> = { BWBR0001830: 'RO', BWBR0005537: 'Awb' };

/** The article that gives the court its say, as cited and as a ref: "art. 60 RO". */
export const basisArticle = (step: CourseStep) => (step.basis ? articleOfBasis(step.basis) : null);

/** An article of the API's list as cited, as a ref and by its readable address: "art. 60 RO" at
 *  `/wetten/BWBR0001830/artikel/60`, so its link needs no detour by /explore?focus. One of a
 *  bijlage by its place, "art. 2 bijlage 2 Awb"; its number has a space, so no address of its
 *  own (the API's `readable_paths`): it opens by its ref. */
export function articleOfBasis(b: Basis): { name: string; ref: BronRef; path: string | null } {
	const law = LAW[b.bwb_id];
	const inAnnex = /^bijlage (\S+) artikel (\S+)$/.exec(b.article_number);
	const number = inAnnex
		? `art. ${inAnnex[2]} bijlage ${inAnnex[1]}`
		: articleRef(b.bwb_id, b.article_number);
	return {
		name: law ? `${number} ${law}` : number,
		ref: {
			collection: 'articles',
			key: `${b.bwb_id}_${b.article_number}`.toLowerCase().replace(/[^a-z0-9]+/g, '_')
		},
		path: /\s/.test(b.article_number)
			? null
			: padHref({
					kind: 'artikel',
					law: b.bwb_id.toUpperCase(),
					number: bookNumber(b.bwb_id, b.article_number)
				})
	};
}
