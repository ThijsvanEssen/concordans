import type { Tier } from '$lib/vocabulary';

// The courts in the order of the rechterlijke organisatie: the highest courts, the courts
// of fact, the courts of the Caribbean part of the Kingdom and the European courts. A tier
// not named here is under Overig. `ehrm` is its own source in the API (`source=echr`).

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
	{
		label: 'Caribisch deel',
		tiers: ['gemeenschappelijk_hof', 'gerecht_in_eerste_aanleg', 'constitutioneel_hof']
	},
	{ label: 'Europees', tiers: ['ehrm', 'hvj_eu'] }
];
