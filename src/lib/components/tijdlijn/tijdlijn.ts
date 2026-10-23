// Één vorm voor elke tijdlijn in Concordans. Een groep
// (dag, jaar, instantie) met regels; elke regel heeft een datum, een teken en een zin.
import type { Snippet } from 'svelte';

export type Teken = 'ja' | 'nee' | 'stuk' | 'activiteit' | 'verwacht' | 'open';
/** A line of a timeline; `B` is what its caller draws under it (`bij`, the Tijdlijn's `onderRegel`). */
export type TijdRegel<B = unknown> = {
	id: string;
	/** ISO-datum; leeg bij wat nog kan volgen. */
	datum: string | null;
	/** Een termijn in plaats van een dag (Loopbaan, Commissies): de jaren in de datumkolom. */
	periode?: { van: string | null; tot: string | null } | null;
	teken: Teken;
	/** De soort bron, voor het teken op de lijn (vormen.ts). */
	soort?: import('$lib/vocabulary').Collection | null;
	/** Het teken zelf, waar de soort het niet zegt: een wetsvoorstel, een bundel stemmingen. */
	vorm?: import('$lib/bron/vormen').Vorm | null;
	/** Klein boven de zin: wie of welke soort. */
	label?: string | null;
	zin: string;
	/** The zin in pieces, the words a reader follows or searched for marked ($lib/text/treffer). */
	zinDelen?: readonly import('$lib/text/treffer').Deel[] | null;
	meta?: string | null;
	/** The numbers in their dossier of the papers the line names (`11`; a letter, `A`, in the
	 *  Eerste Kamer). */
	nummers?: readonly string[] | null;
	/** Under the zin, after the meta: what has links of its own (indieners, a dossier). It
	 *  gets the line's id, as `inhoud` does. */
	onder?: Snippet<[string]> | null;
	href?: string | null;
	/** The bron the line names: a click opens it in place (BronLink), as everywhere. */
	ref?: import('$lib/bron/ref').BronRef | string | null;
	/** Whether the text of a Kamerstuk is in the data (`has_text`): without it, it opens in
	 *  the network (opensOnText). */
	heeftTekst?: boolean | null;
	/** Een besluit of een wetsvoorstel: groter gezet. */
	groot?: boolean;
	/** A line that leads elsewhere on the page (a day of votes to its list), not to a bron. */
	actie?: (() => void) | null;
	/** Under the line, after its meta: what the caller draws with `onderRegel` (a vote of the
	 *  Tweede Kamer: what the coalition did, CoalitieRegel). */
	bij?: B | null;
	/** Wat één klik onder de regel opent: de inhoud van de bron zelf (RijInhoud). De bron
	 *  staat dan een stap verder, in die inhoud; cmd-klik op de zin opent hem meteen. Het
	 *  krijgt de id van de regel, zodat één snippet de regels van een lijst kan dienen. */
	inhoud?: Snippet<[string]> | null;
	/** De datum als knop, waar hij iets op de pagina kiest (alleen deze wijziging). */
	datumKnop?: { titel: string; actie: () => void } | null;
	/** What Bewaar keeps (`documents/<key>`), where the Tijdlijn has Bewaar. */
	bron?: string | null;
	/** Buiten de gekozen jaren: stiller gezet. */
	gedimd?: boolean;
	/** Bij hover, wat de regel zelf niet zegt. */
	hint?: string | null;
};
export type TijdGroep<B = unknown> = {
	id: string;
	titel: string;
	sub?: string | null;
	/** Het jaar dat de kop al noemt: dan staat het niet nog eens onder elke dag. */
	jaar?: string | null;
	regels: TijdRegel<B>[];
	noot?: string | null;
};

/** Een verloop (procedure, wijzigingen) loopt van oud naar nieuw, een overzicht andersom. */
export type Volgorde = 'oplopend' | 'aflopend';

/**
 * De regels van een groep op datum, stabiel: regels van één dag houden hun volgorde. Wat
 * nog kan volgen (zonder datum) staat achteraan.
 */
export function sorteer<R extends TijdRegel>(regels: readonly R[], volgorde: Volgorde): R[] {
	const richting = volgorde === 'oplopend' ? 1 : -1;
	return [...regels].sort((a, b) => {
		if (!a.datum || !b.datum) return (a.datum ? 0 : 1) - (b.datum ? 0 : 1);
		return richting * a.datum.slice(0, 10).localeCompare(b.datum.slice(0, 10));
	});
}

/** The one year a group's lines fall in, for its heading; null where they span more. */
export function enigJaar(regels: readonly TijdRegel[]): string | null {
	const jaren = new Set(regels.flatMap((r) => (r.datum ? [r.datum.slice(0, 4)] : [])));
	return jaren.size === 1 ? [...jaren][0] : null;
}
