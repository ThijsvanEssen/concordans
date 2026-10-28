// The judgments that cite an article or a law per instantie, as the API counts them over all
// of them (the `tier` facet of `/cited-by`, which adds up to `judgment_total`): the bar of
// the group Uitspraken and its groups in the network (besluit 32). One request per bron, the
// one its group makes; the rest of the total is Overige instanties.
import { LAW_JUDGMENTS } from '$lib/api/first-pages';
import { abortable } from '$lib/api/records';
import { getCitedByTop } from '$lib/api/articles';
import { getInstrumentJudgments } from '$lib/api/verbonden';
import { formatCount } from '$lib/text/getal';
import { TIER_LABEL, type Tier } from '$lib/vocabulary';

/** The step of rubriek-rechtspraak an instantie stands in (Design System, VerbondenGroep). */
type Trap = 1 | 2 | 3 | 4;

type CourtGroup = {
	/** The tiers the API counts as this instantie: the Parket stands with the Hoge Raad, as the filter Rechter has it. */
	tiers: readonly Tier[];
	trap: Trap;
	/** The Europese hoven stand hatched, after the Dutch ones. */
	europa?: true;
	/** In a sentence: `Alle drie van de Hoge Raad`. */
	phrase: string;
};

/** The instanties counted on their own, in the order of the strook: the highest rechter first,
 *  then the Europese hoven; Overige instanties last. */
const INSTANTIES: readonly CourtGroup[] = [
	{ tiers: ['hoge_raad', 'parket'], trap: 1, phrase: 'de Hoge Raad' },
	{ tiers: ['raad_van_state'], trap: 2, phrase: 'de Raad van State' },
	{ tiers: ['centrale_raad_van_beroep'], trap: 2, phrase: 'de Centrale Raad van Beroep' },
	{
		tiers: ['college_van_beroep_bedrijfsleven'],
		trap: 2,
		phrase: 'het College van Beroep voor het bedrijfsleven'
	},
	{ tiers: ['gerechtshof'], trap: 3, phrase: 'de gerechtshoven' },
	{ tiers: ['rechtbank'], trap: 4, phrase: 'de rechtbanken' },
	{ tiers: ['ehrm'], trap: 1, europa: true, phrase: 'het EHRM' },
	{ tiers: ['hvj_eu'], trap: 2, europa: true, phrase: 'het Hof van Justitie EU' }
];

/** What a vlak needs of an instantie: its trap (null: Overige instanties) and whether it is a Europees hof. */
export type TierShape = { trap: Trap | null; europa: boolean };

/** The vlak of the instantie a judgment's tier belongs to. */
export function shapeOfTier(tier: string | null | undefined): TierShape {
	const i = INSTANTIES.find((x) => (x.tiers as readonly string[]).includes(tier ?? ''));
	return { trap: i?.trap ?? null, europa: !!i?.europa };
}

export type TierCount = {
	tier: Tier | null;
	label: string;
	count: number;
	trap: Trap | null;
	europa: boolean;
	phrase: string;
};

export const OTHER_TIERS = 'Overige instanties';

/**
 * The parts of `total` from the count per tier (the facet), in the order of INSTANTIES, the
 * rest as Overige instanties; a part of none left out. Counts that add up to more than the
 * total leave no rest.
 */
export function tierParts(
	facet: readonly { value?: string | null; count: number }[],
	total: number
): TierCount[] {
	const of = (tiers: readonly Tier[]) =>
		facet.reduce(
			(n, f) => n + (f.value && (tiers as readonly string[]).includes(f.value) ? f.count : 0),
			0
		);
	const parts: TierCount[] = INSTANTIES.map((i) => ({
		tier: i.tiers[0],
		label: TIER_LABEL[i.tiers[0]],
		count: of(i.tiers),
		trap: i.trap,
		europa: !!i.europa,
		phrase: i.phrase
	}));
	const rest = total - parts.reduce((sum, p) => sum + p.count, 0);
	if (rest > 0)
		parts.push({
			tier: null,
			label: OTHER_TIERS,
			count: rest,
			trap: null,
			europa: false,
			phrase: 'overige instanties'
		});
	return parts.filter((p) => p.count > 0);
}

const NUMBER_WORDS = [
	'twee',
	'drie',
	'vier',
	'vijf',
	'zes',
	'zeven',
	'acht',
	'negen',
	'tien',
	'elf',
	'twaalf'
];

/** Where one instantie is all there is, no strook: `Alle drie van de Hoge Raad`; else null. */
export function singleTierLine(parts: readonly TierCount[] | null): string | null {
	if (!parts || parts.length !== 1) return null;
	const { count, phrase } = parts[0];
	if (count === 1) return `De enige van ${phrase}`;
	return `Alle ${NUMBER_WORDS[count - 2] ?? formatCount(count)} van ${phrase}`;
}

/** The judgments that cite the article per instantie, out of `total`. */
export async function citingTiers(
	bwb: string,
	number: string,
	total: number,
	signal?: AbortSignal
): Promise<TierCount[]> {
	const page = await getCitedByTop(bwb, number, signal);
	return tierParts(page.facets?.tier ?? [], total);
}

/**
 * The judgments that cite a law per instantie: the tier facet of the first page of the law's
 * judgments (the request its group makes, so none more), which counts judgments as `total` does.
 */
export async function lawTiers(
	bwb: string,
	total: number,
	signal?: AbortSignal
): Promise<TierCount[]> {
	const page = await abortable(
		getInstrumentJudgments(bwb, { limit: LAW_JUDGMENTS, sort: 'date' }),
		signal
	);
	return tierParts(page.facets?.tier ?? [], total);
}
