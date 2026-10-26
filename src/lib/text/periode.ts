// The period of a list: one filter for every list with dates, said in words (Design System,
// Periode). Days as the URL and the API hold them (YYYY-MM-DD); a reader types a year or a
// date, and reads the period back as "Sinds 2020" or "1 jan 2024 tot 30 jun 2024".
import { MONTHS, isDay } from './datum';

/** A date as the period says it: day, month in three letters without a full stop, year. */
const MAAND_KORT = [
	'jan',
	'feb',
	'mrt',
	'apr',
	'mei',
	'jun',
	'jul',
	'aug',
	'sep',
	'okt',
	'nov',
	'dec'
];

export type Snelkeuze = { id: string; label: string; van: (vandaag: string) => string };

/** The choices at once: a period back from today, from a year on, or without bounds. */
export const SNELKEUZEN: readonly Snelkeuze[] = [
	{ id: 'maand', label: 'Afgelopen maand', van: (v) => maandenTerug(v, 1) },
	{ id: 'jaar', label: 'Afgelopen jaar', van: (v) => maandenTerug(v, 12) },
	{ id: 'vijf', label: 'Afgelopen 5 jaar', van: (v) => maandenTerug(v, 60) },
	{ id: 'sinds-2000', label: 'Sinds 2000', van: () => '2000-01-01' },
	{ id: 'alles', label: 'Alle jaren', van: () => '' }
];

export const FOUT_TOT_VOOR_VAN = 'Tot ligt voor van.';
const HULP = 'Typ een jaar of een datum als 1-3-2024.';

/** The day `maanden` months before `vandaag`, the same day of the month where it exists. */
export function maandenTerug(vandaag: string, maanden: number): string {
	const [y, m, d] = vandaag.split('-').map(Number);
	const doel = new Date(Date.UTC(y, m - 1 - maanden, 1));
	const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
	doel.setUTCDate(Math.min(d, laatste));
	return doel.toISOString().slice(0, 10);
}

/** Which snelkeuze a period is, or null for a period of its own. */
export function snelkeuzeVan(van: string, tot: string, vandaag: string): string | null {
	if (tot) return null;
	return SNELKEUZEN.find((s) => s.van(vandaag) === van)?.id ?? null;
}

/** A bound as the URL holds it: a day; anything else is no bound. */
export function alsDag(v: string | null | undefined): string | null {
	const s = (v ?? '').trim();
	return isDay(s) ? s : null;
}

/** `2024-03-01` as "1 mrt 2024". */
export function formatDag(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return `${d} ${MAAND_KORT[m - 1]} ${y}`;
}

type Kant = 'van' | 'tot';

/** The year a bound stands for, where it is a whole year's first day (van) or last (tot). */
function heelJaar(iso: string, kant: Kant): string | null {
	const [y, rest] = [iso.slice(0, 4), iso.slice(4)];
	return rest === (kant === 'van' ? '-01-01' : '-12-31') ? y : null;
}

/** A bound as a field shows it: a year where it is a whole year's edge, else "1 mrt 2024". */
export const veldTekst = (iso: string, kant: Kant): string =>
	iso ? (heelJaar(iso, kant) ?? formatDag(iso)) : '';

/** A period in words; the name of a snelkeuze where it is one. */
export function woorden(van: string, tot: string, vandaag: string): string {
	if (!van && !tot) return 'Alle jaren';
	const snel = SNELKEUZEN.find((s) => s.id === snelkeuzeVan(van, tot, vandaag));
	if (snel) return snel.label;
	const jaren = (!van || heelJaar(van, 'van')) && (!tot || heelJaar(tot, 'tot'));
	const zeg = (iso: string) => (jaren ? iso.slice(0, 4) : formatDag(iso));
	const [a, b] = [van && zeg(van), tot && zeg(tot)];
	if (a && b) return `${a} tot ${b}`;
	return a ? `Sinds ${a}` : `Tot ${b}`;
}

const dagenIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** The month a word names: "mrt", "maart", "mrt." (the first three letters decide). */
function maandNummer(woord: string): number {
	const w = woord.toLowerCase().replace(/\.$/, '');
	if (w.length < 3) return 0;
	return MAAND_KORT.findIndex((k, i) => w === k || MONTHS[i].startsWith(w)) + 1;
}

export type Gelezen = { dag: string } | { fout: string };

/**
 * A typed bound: empty (no bound), a year (the first of January for van, the 31st of
 * December for tot), or a date as 1-3-2024, 1/3/2024, 2024-03-01 or 1 mrt 2024.
 */
export function leesGrens(tekst: string, kant: Kant): Gelezen {
	const t = tekst.trim();
	if (!t) return { dag: '' };
	if (/^\d{4}$/.test(t)) return { dag: kant === 'van' ? `${t}-01-01` : `${t}-12-31` };
	const delen =
		/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})$/.exec(t) ??
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
	let d: number, m: number, y: number;
	if (delen) {
		const iso = delen[1].length === 4;
		[d, m, y] = (iso ? [delen[3], delen[2], delen[1]] : [delen[1], delen[2], delen[3]]).map(Number);
	} else {
		const woord = /^(\d{1,2})\s+([a-zA-Z]{3,9}\.?)\s+(\d{4})$/.exec(t);
		if (!woord || !maandNummer(woord[2])) return { fout: HULP };
		[d, m, y] = [Number(woord[1]), maandNummer(woord[2]), Number(woord[3])];
	}
	if (m < 1 || m > 12 || d < 1) return { fout: HULP };
	if (d > dagenIn(y, m)) {
		return { fout: `${d} ${MONTHS[m - 1]} bestaat niet. ${HULP}` };
	}
	return { dag: `${y}-${pad(m)}-${pad(d)}` };
}
