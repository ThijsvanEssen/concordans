// Who sat in a period: the seats of today unless a period or the historical ones are asked.
/** Only the seats of today: with a period the period says who, as "Ook oud-leden" does. */
export const seatedOnly = (includeInactive: boolean, from: string, to: string): boolean =>
	!includeInactive && !from && !to;
