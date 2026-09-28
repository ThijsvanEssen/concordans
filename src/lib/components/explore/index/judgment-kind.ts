import type { Tier } from '$lib/vocabulary';

// What a judgment is called: the API's `decision_kind` (arrest, vonnis, beschikking, …).
// Where it gives none, the court decides: an arrest of the Hoge Raad or a hof, a vonnis of
// a rechtbank, a conclusie of the Parket and an uitspraak of the bestuursrechters and the
// other colleges. The European courts give arresten.

const BY_TIER: Partial<Record<Tier, string>> = {
	hoge_raad: 'arrest',
	gerechtshof: 'arrest',
	hvj_eu: 'arrest',
	ehrm: 'arrest',
	rechtbank: 'vonnis',
	kantongerecht: 'vonnis',
	parket: 'conclusie'
};

/** `tier` as the list gives it: a string the API may widen. */
export function judgmentKind(
	decisionKind: string | null | undefined,
	tier: string | null | undefined
): string {
	const kind = decisionKind || (tier && BY_TIER[tier as Tier]) || 'uitspraak';
	return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * The title of a judgment in a list whose left column already gives its date and court:
 * the name it is known by, else its case number. `display_name` repeats court and date
 * ("Raad van State 2026-09-23 / 202505108/1/A2").
 */
export function judgmentRowTitle(j: {
	names?: string[] | null;
	display_name?: string | null;
	ecli?: string | null;
	key: string;
}): string {
	if (j.names?.length) return j.names.join(', ');
	const caseNumber = /\s\/\s(.+)$/.exec(j.display_name ?? '')?.[1];
	return caseNumber ?? j.display_name ?? j.ecli ?? j.key;
}
