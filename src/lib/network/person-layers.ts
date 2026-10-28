// The layers of a person's keten, in the order of their rubriek: Parlement (Fractie, Commissie),
// then Regering (Kabinet, Ministerie), each in the colour of its rubriek. One place for the order
// and the colours.
export const PERSON_LAYERS = ['factions', 'committees', 'cabinets', 'ministries'] as const;

/** The rubriek colour of a layer of a person's keten, or null for any other bron. */
export function sectionColour(collection: string): string | null {
	switch (collection) {
		case 'factions':
		case 'committees':
			return 'var(--rubriek-parlement)';
		case 'cabinets':
		case 'ministries':
			return 'var(--rubriek-regering)';
		default:
			return null;
	}
}
