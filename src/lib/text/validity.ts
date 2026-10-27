// The one line that says whether a law or an article holds (besluit 30): "Ingetrokken per 1
// januari 2020" for a law, "Vervallen per 1 januari 2020" for an article (docs/woorden.md), or
// "Nog niet in werking (per 1 januari 2027)". A thing that holds has none (its text says it);
// the label "Geldend" stands only where the API says it holds.
import type { Validity } from '$lib/api/validity';
import { langeDatum } from '$lib/text/datum';

type Status = { text: string; negative: boolean };

/** What has the validity: a law is ingetrokken, an article (or a bijlage) vervallen. */
export type Soort = 'wet' | 'artikel';

/** The words of a validity that is not in force; null for one that holds or is not known. */
export function statusOf(v: Validity | null | undefined, soort: Soort = 'artikel'): Status | null {
	if (v?.state === 'expired') {
		const day = langeDatum(v.date);
		const woord = soort === 'wet' ? 'Ingetrokken' : 'Vervallen';
		return { text: day ? `${woord} per ${day}` : woord, negative: true };
	}
	if (v?.state === 'not_in_force_yet') {
		const day = langeDatum(v.date);
		return {
			text: day ? `Nog niet in werking (per ${day})` : 'Nog niet in werking',
			negative: false
		};
	}
	return null;
}

/** Whether the API says it holds today (the only case that may be called "geldend"). */
export const holds = (v: Validity | null | undefined): boolean => v?.state === 'in_force';
