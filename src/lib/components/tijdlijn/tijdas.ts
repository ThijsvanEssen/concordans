// Eén as voor elke horizontale tijdweergave: de posten van een kabinet, de kabinetten, de
// zetels. Een plek op de as is een fractie van de periode (0 aan het begin, 1 aan het eind);
// de streepjes kiezen hun stap naar de breedte, zodat twee labels nooit botsen en geen label
// tegen een rand komt.
import { korteDatum, maandJaar, vandaag } from '$lib/text/datum';

const DAG = 86_400_000;
export const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export type Periode = { van: number; tot: number; lopend: boolean };
export type Streepje = { at: number; label: string };

/** Tussen twee labels minstens 56px, en een label niet binnen 40px van een rand. */
const AFSTAND = 56;
const RAND = 40;

/**
 * De streepjes voor een periode op een breedte: per kwartaal, per jaar, of per 2, 5 of 10
 * jaar, de kleinste stap die past. Een kwartaal heet `okt. 2024`, een jaar `2025`.
 */
export function streepjes(
	p: Periode,
	breedte: number,
	randen: { begin: number; eind: number } = { begin: RAND, eind: RAND }
): Streepje[] {
	const jaren = (p.tot - p.van) / (365.25 * DAG);
	const stappen = [3, 12, 24, 60, 120]; // maanden
	for (const maanden of stappen) {
		const aantal = (jaren * 12) / maanden;
		if (aantal > 0 && breedte / aantal < AFSTAND) continue;
		return stap(p, maanden, breedte, randen);
	}
	return stap(p, 120, breedte, randen);
}

/** Hoe breed een label op t-label ongeveer is: genoeg om botsen te voorkomen. */
export const labelBreedte = (tekst: string) => tekst.length * 6 + 8;

/**
 * Fasen op regels: een naam die tegen de vorige aan zou komen gaat een regel lager; aan de
 * rechterrand staat een naam naar binnen.
 */
export function faseRegels(
	fasen: { at: number; label: string }[],
	breedte: number
): { at: number; label: string; regel: number; binnen: boolean }[] {
	const einden: number[] = [];
	return fasen.map((f) => {
		const x = f.at * breedte;
		const w = labelBreedte(f.label) + 8;
		const binnen = x + w > breedte;
		const van = binnen ? x - w : x;
		let regel = einden.findIndex((e) => e <= van);
		if (regel < 0) regel = einden.push(0) - 1;
		einden[regel] = van + w;
		return { ...f, regel, binnen };
	});
}

function stap(
	p: Periode,
	maanden: number,
	breedte: number,
	randen: { begin: number; eind: number }
): Streepje[] {
	const uit: Streepje[] = [];
	const d = new Date(p.van);
	let y = d.getUTCFullYear();
	let m = Math.ceil(d.getUTCMonth() / Math.min(maanden, 12)) * Math.min(maanden, 12);
	if (maanden > 12) {
		const jaren = maanden / 12;
		y = Math.ceil((y + (m > 0 ? 1 : 0)) / jaren) * jaren;
		m = 0;
	}
	for (let i = 0; i < 400; i++) {
		y += Math.floor(m / 12);
		m %= 12;
		const t = Date.UTC(y, m, 1);
		if (t > p.tot) break;
		const at = (t - p.van) / (p.tot - p.van);
		const px = at * breedte;
		if (t >= p.van && px >= randen.begin && px <= breedte - randen.eind)
			uit.push({
				at,
				label:
					maanden === 3 && m !== 0
						? maandJaar(`${y}-${String(m + 1).padStart(2, '0')}-01`)
						: String(y)
			});
		m += maanden;
	}
	return uit;
}

/** De randen in woorden: het begin als datum, het eind als datum of `nu`. */
export function randen(
	van: string,
	tot: string | null,
	lopend: boolean,
	fmt: (iso: string) => string = korteDatum
): { begin: string; eind: string } {
	return { begin: fmt(van), eind: lopend || !tot ? 'nu' : fmt(tot) };
}

/** Een periode in een zin: `sinds 23 feb. 2026` of `van 2 jul. 2024 tot 23 feb. 2026`. */
export function periodeZin(
	van: string | null | undefined,
	tot: string | null | undefined,
	fmt: (iso: string) => string = korteDatum,
	vandaagIso = vandaag()
): string {
	if (!van) return tot ? `tot ${fmt(tot)}` : 'periode niet in de gegevens';
	if (!tot || tot >= vandaagIso) return `sinds ${fmt(van)}`;
	return `${fmt(van)} tot ${fmt(tot)}`;
}
