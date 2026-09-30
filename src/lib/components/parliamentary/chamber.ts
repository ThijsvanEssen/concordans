// The two Kamers of the Staten-Generaal, as the API names them (`chamber`) and as the site
// writes them: in full where there is room, `TK` and `EK` with the full name as a tooltip
// where there is not.

export type Chamber = 'TK' | 'EK';

export const CHAMBERS: readonly Chamber[] = ['TK', 'EK'];

export const CHAMBER_NAME: Record<Chamber, string> = {
	TK: 'Tweede Kamer',
	EK: 'Eerste Kamer'
};

/** A Kamer from the URL (`?kamer=EK`), in either case; anything else is none. */
export function chamberFromParam(value: string | null | undefined): Chamber | undefined {
	const v = value?.toUpperCase();
	return v === 'TK' || v === 'EK' ? v : undefined;
}

/** The Eerste Kamer's data comes from its own site, under its terms, named as it asks. */
export const EK_SOURCE = {
	name: 'Eerste Kamer der Staten-Generaal',
	site: 'www.eerstekamer.nl',
	url: 'https://www.eerstekamer.nl'
} as const;
