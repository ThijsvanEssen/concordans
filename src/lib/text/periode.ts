// The period of a list: one filter for every list with dates (Thijs, 9 Oct: "een
// tijdsfilter systematisch in alle filterpanes"). Days as the URL and the API hold them
// (YYYY-MM-DD), a few periods back from today to choose at once, and a van and tot.
import { isDay } from './datum';

type Voorkeuze = { id: string; label: string; titel: string; maanden: number };

export const VOORKEUZEN: readonly Voorkeuze[] = [
	{ id: 'maand', label: 'Maand', titel: 'De afgelopen maand', maanden: 1 },
	{ id: 'kwartaal', label: 'Kwartaal', titel: 'De afgelopen drie maanden', maanden: 3 },
	{ id: 'jaar', label: 'Jaar', titel: 'Het afgelopen jaar', maanden: 12 }
];

/** The day `maanden` months before `vandaag`, the same day of the month where it exists. */
export function maandenTerug(vandaag: string, maanden: number): string {
	const [y, m, d] = vandaag.split('-').map(Number);
	const doel = new Date(Date.UTC(y, m - 1 - maanden, 1));
	const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
	doel.setUTCDate(Math.min(d, laatste));
	return doel.toISOString().slice(0, 10);
}

/** Which choice a period is: `alles` without bounds, a voorkeuze, or null for its own. */
export function gekozen(van: string, tot: string, vandaag: string): string | null {
	if (!van && !tot) return 'alles';
	if (tot) return null;
	return VOORKEUZEN.find((v) => maandenTerug(vandaag, v.maanden) === van)?.id ?? null;
}

/** A bound as the URL holds it: a day; anything else is no bound. */
export function alsDag(v: string | null | undefined): string | null {
	const s = (v ?? '').trim();
	return isDay(s) ? s : null;
}
