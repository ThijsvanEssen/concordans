// How complete a part of a bron is in the dataset, in the one form the site says it: a quiet
// line where the reader would otherwise take silence for completeness (besluit 23). The words
// live here and only here; the shape follows the API's `completeness` that is coming (an
// onderdeel, its state, a date), so that field can feed this line when it arrives.
import { langeDatum } from '$lib/text/datum';

/** A part of a bron (`onderdeel`, as the API will name it) and how far the dataset has it. */
export type DekkingStaat =
	/** The step ran and found nothing: a regeling of the BWB without articles. */
	| { onderdeel: 'text'; state: 'none' }
	/** The source does not deliver it: the consolidated versions of an act of the EU. */
	| { onderdeel: 'versions'; state: 'not_in_source'; as_of?: string | null };

/** The line, in words: `Tekst niet ingelezen`. */
export function dekkingZin(d: DekkingStaat): string {
	if (d.onderdeel === 'text') return 'Tekst niet ingelezen';
	const op = d.as_of ? ` op ${langeDatum(d.as_of)}` : '';
	return `Tekst zoals vastgesteld${op}, latere wijzigingen niet verwerkt`;
}
