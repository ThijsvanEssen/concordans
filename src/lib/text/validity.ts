// The one line that says whether a law or an article holds (besluit 30): "Vervallen per 1
// januari 2020" or "Nog niet in werking (per 1 januari 2027)". A thing that holds has none
// (its text says it); the label "Geldend" stands only where the API says it holds.
import type { Validity } from '$lib/api/validity';
import { langeDatum } from '$lib/text/datum';

type Status = { text: string; negative: boolean };

/** The words of a validity that is not in force; null for one that holds or is not known. */
export function statusOf(v: Validity | null | undefined): Status | null {
	if (v?.state === 'expired') {
		const day = langeDatum(v.date);
		return { text: day ? `Vervallen per ${day}` : 'Vervallen', negative: true };
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
