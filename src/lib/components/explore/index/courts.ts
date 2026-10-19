import type { EuropeanSource, Tier } from '$lib/vocabulary';

// The courts in the order of the rechterlijke organisatie: the highest courts, the courts
// of fact, the courts of the Caribbean part of the Kingdom and the European courts. A tier
// not named here is under Overig.

export const COURT_GROUPS: { label: string; tiers: readonly Tier[] }[] = [
	{
		label: 'Hoogste rechters',
		tiers: [
			'hoge_raad',
			'parket',
			'raad_van_state',
			'centrale_raad_van_beroep',
			'college_van_beroep_bedrijfsleven'
		]
	},
	{ label: 'Feitenrechtspraak', tiers: ['gerechtshof', 'rechtbank', 'kantongerecht'] },
	{ label: 'Caribisch deel', tiers: ['koninkrijksinstantie'] },
	{ label: 'Europees', tiers: ['ehrm', 'hvj_eu'] }
];

/**
 * The European courts, each its own source in the API: the EHRM (`source=echr`) and the Hof
 * van Justitie EU with the Gerecht (`source=cjeu`). Chosen, the list holds their own
 * judgments, not the Dutch records that name them as court.
 */
export const SOURCE_OF_TIER: Partial<Record<Tier, EuropeanSource>> = {
	ehrm: 'echr',
	hvj_eu: 'cjeu'
};

/** The tiers that hold several kinds of court: chosen, they list their courts beneath. */
export const MIXED_TIERS: readonly Tier[] = ['andere_instantie', 'koninkrijksinstantie'];
