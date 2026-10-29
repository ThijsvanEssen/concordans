// De lagere rechtspraak van een dag in Actueel: één samenvattende rij met de verdeling per
// rechtsgebied (`lower_courts` van de samenvatting), die opent tot kopjes per rechtsgebied.
// De tellingen komen uit de samenvatting, de uitspraken per kopje worden lui opgehaald.
import { count } from '$lib/text/words';
import { formatCount } from '$lib/text/getal';
import type { LowerCourts } from './feed';

/** The tiers the summary counts as the lower courts (API `LOWER_TIERS`), as `tier` takes them. */
export const LOWER_TIERS = [
	'gerechtshof',
	'rechtbank',
	'kantongerecht',
	'tuchtcollege',
	'andere_instantie',
	'koninkrijksinstantie'
].join(',');

/** `subject_area` for the judgments without a rechtsgebied: a gap in the source, named as one. */
const NO_AREA = 'none';
/** The label of that gap. */
const NO_AREA_LABEL = 'onbekend';

/** How many judgments a heading shows before "Alle N". */
export const FIRST_JUDGMENTS = 3;
/** How many one step of "Alle N" and "Volgende" brings. */
export const PAGE_JUDGMENTS = 50;
/** The headings that open with the row; the rest wait for their own click. */
export const OPEN_AREAS = 2;
/** The rechtsgebieden named in the line under the row; the rest are counted. */
const AREAS_NAMED = 4;

/** What `rechtspraak/<day>` names in `?open=`. */
export const rowId = (date: string) => `rechtspraak/${date}`;

export type LowerArea = { value: string | null; count: number };

/** The `subject_area` filter of an area. */
export const areaParam = (a: LowerArea) => a.value ?? NO_AREA;

/** The area as a heading reads it: the source's word, or "onbekend" for the gap. */
export const areaLabel = (a: LowerArea) => a.value ?? NO_AREA_LABEL;

/** The row's headline: how many judgments, each once. */
export const rowHeadline = (l: LowerCourts) => count(l.total, 'uitspraak', 'uitspraken');

/**
 * The line under the row: the largest areas with their number, in lower case in the sentence,
 * then the others counted. An area counts every judgment that has it, so the numbers may
 * add up to more than the headline.
 */
export function areaLine(l: LowerCourts): string {
	const named = l.subject_areas.slice(0, AREAS_NAMED);
	const rest = l.subject_areas.length - named.length;
	const parts = named.map((a, n) => {
		const label = areaLabel(a);
		return `${n ? label.toLowerCase() : label} ${formatCount(a.count)}`;
	});
	if (rest > 0) parts.push(`en ${count(rest, 'ander rechtsgebied', 'andere rechtsgebieden')}`);
	return parts.join(', ').replace(', en ', ' en ');
}

/** The query of the judgments of one area on one day, the first page or a later one. */
export function areaQuery(date: string, a: LowerArea, limit: number, cursor?: string | null) {
	return {
		tier: LOWER_TIERS,
		subject_area: areaParam(a),
		since: date,
		until: date,
		kind: 'uitspraak',
		facets: false,
		limit,
		...(cursor ? { cursor } : {})
	};
}
