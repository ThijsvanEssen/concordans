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
