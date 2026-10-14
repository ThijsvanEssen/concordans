// The two Kamers of the Staten-Generaal, as the API names them (`chamber`) and as the site
// writes them: in full where there is room, `TK` and `EK` with the full name as a tooltip
// where there is not.

export type Chamber = 'TK' | 'EK';

export const CHAMBERS: readonly Chamber[] = ['TK', 'EK'];

export const CHAMBER_NAME: Record<Chamber, string> = {
	TK: 'Tweede Kamer',
	EK: 'Eerste Kamer'
};

/** Each Kamer as the choice of a filter, by its name. */
export const CHAMBER_OPTIONS = CHAMBERS.map((c) => ({ waarde: c, label: CHAMBER_NAME[c] }));

/** The choice of a filter on both Kamers: no Kamer chosen. */
export const BOTH_CHAMBERS = 'beide';

/** Both Kamers, then each, as Actueel and Overzicht offer them. */
export const CHAMBER_CHOICES = [{ waarde: BOTH_CHAMBERS, label: 'Beide' }, ...CHAMBER_OPTIONS];

/** A Kamer from the URL (`?kamer=EK`), in either case; anything else is none. */
export function chamberFromParam(value: string | null | undefined): Chamber | undefined {
	const v = value?.toUpperCase();
	return v === 'TK' || v === 'EK' ? v : undefined;
}

/** The name of a Kamer as the API gives it (`'EK'`); a record without one is the Tweede Kamer's. */
export const chamberName = (value: string | null | undefined): string =>
	CHAMBER_NAME[chamberFromParam(value) ?? 'TK'];

/** The Eerste Kamer's data comes from its own site, under its terms, named as it asks. */
export const EK_SOURCE = {
	name: 'Eerste Kamer der Staten-Generaal',
	site: 'www.eerstekamer.nl',
	url: 'https://www.eerstekamer.nl'
} as const;
