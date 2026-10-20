// How complete a part of a bron is in the dataset, in the one form the site says it: a quiet
// line where the reader would otherwise take silence for completeness (besluit 23). The words
// live here and only here; the shape follows the API's `completeness` that is coming (a
// part, its state, a date), so that field can feed this line when it arrives.
import { langeDatum } from '$lib/text/datum';

/** A part of a bron, as the API will name it, and how far the dataset has it. */
export type CoverageState =
	/** The step ran and found nothing: a regeling of the BWB without articles. */
	| { part: 'text'; state: 'none' }
	/** The source does not deliver it: the consolidated versions of an act of the EU. */
	| { part: 'versions'; state: 'not_in_source'; as_of?: string | null };

/** The line, in words: `Tekst niet ingelezen`. */
export function coverageLine(d: CoverageState): string {
	if (d.part === 'text') return 'Tekst niet ingelezen';
	const on = d.as_of ? ` op ${langeDatum(d.as_of)}` : '';
	return `Tekst zoals vastgesteld${on}, latere wijzigingen niet verwerkt`;
}
