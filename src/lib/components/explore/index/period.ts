// The period filter of the lists whose route takes one, and of the bewindspersonen, whose
// posts carry their own days: the label says which date the period is about.
export const PERIOD_LABEL: Partial<Record<string, string>> = {
	instruments: 'In werking getreden',
	commitments: 'Gedaan',
	members: 'Actief',
	factions: 'Actief',
	committees: 'Actief',
	ministers: 'In functie'
};

/** Only the seats of today: with a period the period says who, as "Ook oud-leden" does. */
export const seatedOnly = (includeInactive: boolean, from: string, to: string): boolean =>
	!includeInactive && !from && !to;
