// The kind of a Kamerstuk as the source gives it (`props.kind`: "Motie (gewijzigd/nader)",
// "Memorie van toelichting", "Geleidende brief"), read in one place: which kind it is, and how
// a row or a reader writes it.

const kindText = (kind: unknown): string => (typeof kind === 'string' ? kind.trim() : '');

/** `motie` or `amendement` for a paper of that kind, by the word its kind opens with (also a count's `Moties`); else null. */
export function motionOrAmendment(kind: unknown): 'motie' | 'amendement' | null {
	const word = /^(motie|amendement)/i.exec(kindText(kind))?.[1].toLowerCase();
	return word === 'motie' || word === 'amendement' ? word : null;
}

/** A letter of any sender: "Brief regering", "Brief van lid/fractie/commissie". */
export const isLetter = (kind: unknown): boolean => /^brief/i.test(kindText(kind));

/** A letter that offers a paper (geleidende brief, aanbiedingsbrief): it says nothing without it. */
export const isCoverLetter = (kind: unknown): boolean =>
	/geleidende brief|aanbiedingsbrief/i.test(kindText(kind));

/** The voorstel van wet itself. */
export const isBill = (kind: unknown): boolean => /^voorstel van wet/i.test(kindText(kind));

/**
 * A paper that changes or explains a bill (nota van wijziging, memorie van toelichting, nader
 * rapport, nota naar aanleiding van het verslag): its voorstel van wet is named beside it.
 */
export const belongsToBill = (kind: unknown): boolean =>
	/nota van wijziging|memorie van toelichting|nader rapport|naar aanleiding van het verslag/i.test(
		kindText(kind)
	);

/**
 * The papers of a bill that carry the bill's own title: the voorstel, its toelichting, the
 * nota's and verslagen, the advies, the eindtekst. Within a dossier that title is the same for
 * all of them; the kind and the number tell them apart.
 */
const BILL_TITLE =
	/^(gewijzigd |nader gewijzigd )?voorstel van wet|^(nadere )?memorie( van)?|^nota (van wijziging|naar aanleiding|n\.a\.v\.)|^(eind|tweede |nader |blanco )?verslag|^advies (afdeling|raad van state)|^nader rapport|^eindtekst|^bijgewerkte tekst|^koninklijke boodschap/i;

export const carriesBillTitle = (kind: unknown): boolean => BILL_TITLE.test(kindText(kind));

/** `Motie` from `Motie (gewijzigd)`: a kind short, without what the source adds in brackets. */
export const shortKind = (kind: string): string => kind.replace(/\s*\(.*\)\s*$/, '');

/**
 * A kind as a reader writes it (UX-toets #31, #58): a group of kinds the source files it under
 * is left out, in brackets ("Amendement (gewijzigd/nader/vervangend)" is "Amendement"; the
 * status line says what it replaces) or as the whole kind ("Brief van lid/fractie/commissie":
 * null, its title says what it is). Any other kind stands as the source gives it.
 */
export function ownKind(kind: unknown): string | null {
	const k = kindText(kind).replace(/\s*\([^()]*\/[^()]*\)$/, '');
	return k && !k.includes('/') ? k : null;
}
