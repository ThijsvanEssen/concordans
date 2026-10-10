// A judgment in a list: its name, its case number and its court, from its display name.
import { keyEcli } from '$lib/bron/leesbaar';

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
	return (
		j.ecli ?? parts(j.display_name).caseNumber ?? j.display_name ?? keyEcli(j.key) ?? 'Uitspraak'
	);
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
