// The names of a law as the interface keeps them (instrument-cache): its title, the name it
// is cited by and its abbreviation, merged from what each answer of the API says of it.
import { enactedLawOfKey } from '$lib/text/enacted-law';
import { textOf } from '$lib/text/words';
import { lawShortName } from '$lib/text/bw';

export type InstrumentMeta = {
	/** BWB id, or the key of an instrument without one (EU). */
	bwbId: string;
	/** "Wetboek van Strafrecht" */
	title: string | null;
	/** "Sr", the abbreviation it is cited by; a book of the BW "Boek 6 BW". */
	shortTitle: string | null;
	citationTitle: string | null;
	/** The abbreviation the API gives (`AVG`, where its short title is "Algemene verordening
	 *  gegevensbescherming"), kept once known. */
	abbreviation?: string | null;
};

/** The id a law is grouped under: its BWB id, or its own key when it has none (EU). */
export function instrumentContainerId(input: { bwb_id?: unknown; key?: unknown }): string | null {
	const key = textOf(input.key);
	return textOf(input.bwb_id) ?? (key && enactedLawOfKey(key)) ?? key;
}

/** What an answer of the API says of an instrument's names. */
export type InstrumentInput = {
	bwb_id?: unknown;
	/** Id of an instrument without a BWB id. */
	key?: unknown;
	title?: unknown;
	display_name?: unknown;
	citation_title?: unknown;
	short_title?: unknown;
	abbreviation?: unknown;
};

/** The names of the instrument `bwbId` once `input` is merged in: a field `input` lacks keeps
 *  its value in `existing`. */
export function metaOf(
	bwbId: string,
	input: InstrumentInput,
	existing?: InstrumentMeta
): InstrumentMeta {
	const title = textOf(input.title) ?? textOf(input.display_name) ?? existing?.title ?? null;
	const citationTitle = textOf(input.citation_title) ?? existing?.citationTitle ?? null;
	// A law is cited by its abbreviation (`AVG`), its short title only where it has none: an act
	// of the EU's short title is a name ("Algemene verordening gegevensbescherming").
	const abbreviation = textOf(input.abbreviation) ?? existing?.abbreviation ?? null;

	return {
		bwbId,
		title: title ?? citationTitle,
		shortTitle: lawShortName(
			bwbId,
			abbreviation ?? textOf(input.short_title) ?? existing?.shortTitle
		),
		citationTitle: citationTitle ?? title,
		abbreviation
	};
}

/**
 * A law by its name: its citation title (a title where it has none, see recordInstrument),
 * else its short title, else `fallback`, mostly its id.
 */
export const lawName = <F extends string | null>(
	meta: InstrumentMeta | null | undefined,
	fallback: F
): string | F => meta?.citationTitle ?? meta?.shortTitle ?? fallback;
