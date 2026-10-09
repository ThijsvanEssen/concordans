// What the coalition did on a vote of the Tweede Kamer (API 0.79.34, #397, `coalition` on a
// decision; Thijs, 10 Oct: "Coalitie verdeeld"). The block gives the seats of the coalition
// and the opposition per side and its pattern; which fractie is of the coalition comes from
// the hall of that day (`coalition` per fractie on /api/parliament/seats). Source values,
// put in words; no reading of them.

/** The block on a decision, as the API gives it. */
export type CoalitieStem = {
	cabinet: string;
	coalition_for: number;
	coalition_against: number;
	opposition_for: number;
	opposition_against: number;
	pattern: 'together' | 'split' | 'wissel';
	carried?: boolean;
	decisive?: boolean;
};

/** The block from a decision of an API that has it; null on one without, or without a cabinet. */
export const coalitieVan = (d: unknown): CoalitieStem | null => {
	const c = (d as { coalition?: CoalitieStem | null } | null)?.coalition;
	return c && typeof c.coalition_for === 'number' ? c : null;
};

export type Kiezer = { id: string; name: string; choice: string; seats: number | null };

export type CoalitieRegel = {
	/** `eensgezind` or `verdeeld`. */
	stand: 'eensgezind' | 'verdeeld';
	/** For a coalition as one: the side it took. */
	kant: 'voor' | 'tegen' | null;
	/** The coalition's seats per side. */
	voor: number;
	tegen: number;
	/** The coalition's fracties per side, by name with their seats; empty without the hall. */
	fractiesVoor: Kiezer[];
	fractiesTegen: Kiezer[];
};

/**
 * The line under a vote. `inCoalitie` says per voter key whether it is of the coalition (the
 * hall of that day); without it the line has the seats and no names.
 */
export function coalitieRegel(
	c: CoalitieStem,
	kiezers: readonly Kiezer[],
	inCoalitie: ((key: string) => boolean | null) | null
): CoalitieRegel {
	const sleutel = (id: string) => id.split('/').at(-1) ?? id;
	const van = (keuze: string) =>
		inCoalitie
			? kiezers.filter((k) => k.choice === keuze && inCoalitie(sleutel(k.id)) === true)
			: [];
	const eensgezind = c.pattern === 'together';
	return {
		stand: eensgezind ? 'eensgezind' : 'verdeeld',
		kant: eensgezind ? (c.coalition_against > 0 ? 'tegen' : 'voor') : null,
		voor: c.coalition_for,
		tegen: c.coalition_against,
		fractiesVoor: van('Voor'),
		fractiesTegen: van('Tegen')
	};
}
