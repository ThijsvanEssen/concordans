// Fractiekleuren zoals de Kamers ze zelf tekenen.
// Tweede Kamer: legenda van "Zetelverdeling plenaire zaal, juni 2026" (tweedekamer.nl, pdf).
// Eerste Kamer: "Wie zit waar" op eerstekamer.nl, 30 september 2026. Hoort in de curated
// lijst party_colors van de back end; hier alleen om het ontwerp te toetsen.
export const KLEUREN: Record<'TK' | 'EK', Record<string, string | [string, string]>> = {
	TK: {
		D66: '#35a948',
		VVD: '#e48230',
		PRO: ['#7ab841', '#d9232a'],
		PVV: '#224665',
		CDA: '#00745a',
		JA21: '#253258',
		FVD: '#7e3134',
		BBB: '#b1bc53',
		DENK: '#42b2ab',
		SGP: '#e05d29',
		PvdD: '#006835',
		ChristenUnie: '#1d92c5',
		SP: '#da3230',
		'50PLUS': '#812c7c',
		Volt: '#2a2350',
		'Groep Markuszower': '#60899f',
		'Lid Keijzer': '#e36c9e'
	},
	EK: {
		PRO: '#ffaacc',
		BBB: '#98c41c',
		VVD: '#f47621',
		D66: '#00d84b',
		CDA: '#00513e',
		PVV: '#002f87',
		ChristenUnie: '#00a5e8',
		FVD: '#600910',
		SP: '#a00000',
		JA21: '#0d6efd',
		PvdD: '#17773c',
		SGP: '#155da5',
		Volt: '#502379',
		'50PLUS': '#93117e',
		'Fractie-Beukering': '#a89d8c',
		'Fractie-Van Gasteren': '#1ccad8',
		'Fractie-Van de Sanden': '#f4d03f',
		'Fractie-Visseren-Hamakers': '#4992a0',
		'Fractie-Walenkamp': '#c18f32',
		OPNL: '#d63384'
	}
};

/** De kleur van een fractie in beide Kamers: die van de Tweede Kamer, en waar de Tweede
 * Kamer geen kleur heeft (eenmansfracties, OPNL) die van de Eerste Kamer (Thijs, 1 okt). */
const kleur = (naam: string) => KLEUREN.TK[naam] ?? KLEUREN.EK[naam];
/** De kleur van een stoel; een fractie met twee kleuren wisselt per stoel. */
export function kleurVan(_kamer: string, naam: string, i: number, fallback: string | null): string {
	const k = kleur(naam);
	if (Array.isArray(k)) return k[i % 2];
	return k ?? fallback ?? '#a39d90';
}
export function kleurenVan(_kamer: string, naam: string, fallback: string | null): string[] {
	const k = kleur(naam);
	return Array.isArray(k) ? k : [k ?? fallback ?? '#a39d90'];
}
/** Wit of inkt op een kleurbalk, naar de luminantie. */
export function tekstOp(hex: string): string {
	const c = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
	const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	return L > 0.32 ? '#161513' : '#ffffff';
}
