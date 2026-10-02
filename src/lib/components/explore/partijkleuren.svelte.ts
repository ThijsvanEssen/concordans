// Fractiekleuren zoals de Kamers ze zelf tekenen, uit de API (0.73, BE-5): de Tweede Kamer
// in de legenda van haar zetelverdeling, de Eerste Kamer in "Wie zit waar". Een fractie
// krijgt in beide Kamers de kleur van de Tweede Kamer, en waar die er geen heeft
// (eenmansfracties, OPNL) die van de Eerste Kamer (Thijs, 1 okt).
import { api } from '$lib/api/client';

const kamers = $state<{ TK: Record<string, string[]>; EK: Record<string, string[]> }>({
	TK: {},
	EK: {}
});
let gevraagd = false;

function laad() {
	if (gevraagd || typeof window === 'undefined') return;
	gevraagd = true;
	api
		.GET('/api/parties/colors')
		.then(({ data }) => {
			kamers.TK = data?.chambers?.TK?.colors ?? {};
			kamers.EK = data?.chambers?.EK?.colors ?? {};
		})
		.catch(() => {
			// De terugvalkleur blijft: de naam van de fractie staat erbij.
		});
}

const zoek = (map: Record<string, string[]>, naam: string) => {
	const k = Object.keys(map).find((x) => x.toLowerCase() === naam.toLowerCase());
	return k ? map[k] : undefined;
};
/** De kleuren van een fractie: die van de Tweede Kamer, anders die van de Eerste Kamer. */
const kleur = (naam: string): string[] | undefined => {
	laad();
	const k = zoek(kamers.TK, naam) ?? zoek(kamers.EK, naam);
	return k?.length ? k : undefined;
};
/** De kleur van een stoel; een fractie met twee kleuren wisselt per stoel. */
export function kleurVan(_kamer: string, naam: string, i: number, fallback: string | null): string {
	const k = kleur(naam);
	return k ? k[i % k.length] : (fallback ?? '#a39d90');
}
export function kleurenVan(_kamer: string, naam: string, fallback: string | null): string[] {
	return kleur(naam) ?? [fallback ?? '#a39d90'];
}
/** Wit of inkt op een kleurbalk, naar de luminantie. */
export function tekstOp(hex: string): string {
	const c = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
	const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	return L > 0.32 ? '#161513' : '#ffffff';
}
