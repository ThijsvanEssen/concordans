// Ontwerpstudie ronde 4 (prototype): één vorm voor elke tijdlijn in Concordans. Een groep
// (dag, instantie of maand) met regels; elke regel heeft een datum, een teken en een zin.
export type Teken = 'ja' | 'nee' | 'stuk' | 'activiteit' | 'verwacht' | 'open';
export type TijdRegel = {
	id: string;
	/** ISO-datum; leeg bij wat nog kan volgen. */
	datum: string | null;
	teken: Teken;
	/** Klein boven de zin: wie of welke soort. */
	label?: string | null;
	zin: string;
	meta?: string | null;
	href?: string | null;
	/** Een besluit of een wetsvoorstel: groter gezet. */
	groot?: boolean;
};
export type TijdGroep = { id: string; titel: string; sub?: string | null; regels: TijdRegel[]; noot?: string | null };

const MAANDEN = ['jan.', 'feb.', 'mrt.', 'apr.', 'mei', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
export const dagMaand = (iso: string) => {
	const [, m, d] = iso.slice(0, 10).split('-').map(Number);
	return `${d} ${MAANDEN[m - 1]}`;
};
