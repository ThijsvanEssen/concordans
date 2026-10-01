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

/** "Raad van State 2026-09-23 / 202406462/1/R2" in its parts: the court in full, the case number. */
function parts(displayName: string | null | undefined) {
	const m = /^(.*?)\s+\d{4}-\d{2}-\d{2}(?:\s*\/\s*(.+))?$/.exec(displayName ?? '');
	return { court: m?.[1]?.trim() || null, caseNumber: m?.[2]?.trim() || null };
}

/**
 * The title of a judgment in a list whose left column already gives its date and court:
 * the name it is known by, else its ECLI, as rechtspraak.nl lists it. The case number
 * ("202406462/1/R2") is context, not the name.
 */
export function judgmentRowTitle(j: {
	names?: string[] | null;
	display_name?: string | null;
	ecli?: string | null;
	key: string;
}): string {
	if (j.names?.length) return j.names.join(', ');
	return j.ecli ?? parts(j.display_name).caseNumber ?? j.display_name ?? j.key;
}

/** The case number of a judgment, from its display name; null where it has none. */
export const judgmentCaseNumber = (displayName: string | null | undefined) =>
	parts(displayName).caseNumber;

/**
 * The court in full, as its display name gives it ("Raad van State", "Rechtbank Den
 * Haag"), not the code of the ECLI ("RVS"); the code where there is no name.
 */
export const judgmentCourt = (displayName: string | null | undefined, code?: string | null) =>
	parts(displayName).court ?? code ?? null;
