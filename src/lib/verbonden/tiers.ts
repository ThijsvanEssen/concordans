// The judgments that cite an article per instantie, as the API counts them over all of them
// (`judgment_total` of `/cited-by` with `tier`): the bar of the group Uitspraken and its
// groups in the network (besluit 32). Three requests of one row each, asked once the group
// stands; the rest of the total is Overige instanties.
import { abortable } from '$lib/api/records';
import { getCitingJudgmentsOfTier } from '$lib/api/verbonden';
import { TIER_LABEL, type Tier } from '$lib/vocabulary';

/** The instanties counted on their own, highest first. */
const COUNTED_TIERS: readonly Tier[] = ['hoge_raad', 'gerechtshof', 'rechtbank'];

/**
 * The tiers one instantie counts: the conclusions of the Parket stand with the Hoge Raad, as
 * the filter Rechter has them (filter.ts RECHTER_OF_TIER), so the bar and the menu give one count.
 */
const TIERS_OF: Partial<Record<Tier, readonly Tier[]>> = { hoge_raad: ['hoge_raad', 'parket'] };

export type TierCount = { tier: Tier | null; label: string; count: number };

export const OTHER_TIERS = 'Overige instanties';

/**
 * The parts of `total` in the order of COUNTED_TIERS, the rest as Overige instanties; a part of
 * none left out. Counts that add up to more than the total (a judgment of two tiers) leave
 * no rest.
 */
export function tierParts(counts: readonly number[], total: number): TierCount[] {
	const parts: TierCount[] = COUNTED_TIERS.map((tier, i) => ({
		tier,
		label: TIER_LABEL[tier],
		count: counts[i] ?? 0
	}));
	const rest = total - parts.reduce((sum, p) => sum + p.count, 0);
	if (rest > 0) parts.push({ tier: null, label: OTHER_TIERS, count: rest });
	return parts.filter((p) => p.count > 0);
}

/** The judgments that cite the article per instantie, out of `total`. */
export async function citingTiers(
	bwb: string,
	number: string,
	total: number,
	signal?: AbortSignal
): Promise<TierCount[]> {
	const counts = await Promise.all(
		COUNTED_TIERS.map((tier) =>
			abortable(getCitingJudgmentsOfTier(bwb, number, TIERS_OF[tier] ?? [tier]), signal)
		)
	);
	return tierParts(counts, total);
}
