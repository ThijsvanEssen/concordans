// Één vorm voor elke tijdlijn in Concordans. Een groep
// (dag, instantie of maand) met regels; elke regel heeft een datum, een teken en een zin.
export type Teken = 'ja' | 'nee' | 'stuk' | 'activiteit' | 'verwacht' | 'open';
export type TijdRegel = {
	id: string;
	/** ISO-datum; leeg bij wat nog kan volgen. */
	datum: string | null;
	teken: Teken;
	/** De soort bron, voor het teken bij het label. */
	soort?: import('$lib/vocabulary').Collection | null;
	/** Klein boven de zin: wie of welke soort. */
	label?: string | null;
	zin: string;
	meta?: string | null;
	href?: string | null;
	/** Een besluit of een wetsvoorstel: groter gezet. */
	groot?: boolean;
};
export type TijdGroep = {
	id: string;
	titel: string;
	sub?: string | null;
	regels: TijdRegel[];
	noot?: string | null;
};

export { dagMaand } from '$lib/text/datum';
