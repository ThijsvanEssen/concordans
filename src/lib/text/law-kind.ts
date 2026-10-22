// The kind of a regulation as the BWB gives it, in the words a lawyer reads: `wet` Wet,
// `amvb` AMvB, `ministeriele-regeling` Ministeriële regeling.

const KIND: Record<string, string> = {
	wet: 'Wet',
	rijkswet: 'Rijkswet',
	amvb: 'AMvB',
	rijksamvb: 'Rijks-AMvB',
	kb: 'Koninklijk besluit',
	rijkskb: 'Rijksbesluit',
	'ministeriele-regeling': 'Ministeriële regeling',
	'ministeriele-regeling-archiefselectielijst': 'Archiefselectielijst',
	beleidsregel: 'Beleidsregel',
	circulaire: 'Circulaire',
	zbo: 'Regeling van een zbo',
	pbo: 'Regeling van een pbo',
	reglement: 'Reglement',
	verdrag: 'Verdrag',
	bilateraalverdrag: 'Bilateraal verdrag',
	multilateraalverdrag: 'Multilateraal verdrag',
	// Not a BWB kind: the API's for a publication in the Staatsblad or Staatscourant.
	publicatie: 'Publicatie'
};

/** The name of a kind the BWB gives, or null for one it does not know. */
export function kindName(kind: string | null | undefined): string | null {
	const k = (kind ?? '').toLowerCase();
	if (KIND[k]) return KIND[k];
	const bes = /^(.+)-bes$/.exec(k);
	return bes && KIND[bes[1]] ? `${KIND[bes[1]]} BES` : null;
}
