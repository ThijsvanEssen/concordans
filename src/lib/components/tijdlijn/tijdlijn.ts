// Één vorm voor elke tijdlijn in Concordans. Een groep
// (dag, instantie of maand) met regels; elke regel heeft een datum, een teken en een zin.
export type Teken = 'ja' | 'nee' | 'stuk' | 'activiteit' | 'verwacht' | 'open';
export type TijdRegel = {
	id: string;
	/** ISO-datum; leeg bij wat nog kan volgen. */
	datum: string | null;
	teken: Teken;
	/** De soort bron, voor het teken op de lijn (vormen.ts). */
	soort?: import('$lib/vocabulary').Collection | null;
	/** Het teken zelf, waar de soort het niet zegt: een wetsvoorstel, een bundel stemmingen. */
	vorm?: import('$lib/bron/vormen').Vorm | null;
	/** Klein boven de zin: wie of welke soort. */
	label?: string | null;
	zin: string;
	meta?: string | null;
	href?: string | null;
	/** The bron the line names: a click opens it in place (BronLink), as everywhere. */
	ref?: import('$lib/bron/href').BronRef | string | null;
	/** Een besluit of een wetsvoorstel: groter gezet. */
	groot?: boolean;
	/** A line that leads elsewhere on the page (a day of votes to its list), not to a bron. */
	actie?: (() => void) | null;
};
export type TijdGroep = {
	id: string;
	titel: string;
	sub?: string | null;
	regels: TijdRegel[];
	noot?: string | null;
};

export { dagMaand } from '$lib/text/datum';
