// The period of a list: one filter for every list with dates, said in words (Design System,
// Periode). Days as the URL and the API hold them (YYYY-MM-DD); a reader types a year or a
// date, and reads the period back as "Sinds 2020" or "1 jan 2024 tot 30 jun 2024".
import { MONTHS, isDay } from './datum';

/** A date as the period says it: day, month in three letters without a full stop, year. */
const MONTHS_SHORT = [
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

type QuickChoice = { id: string; label: string; from: (today: string) => string };

/** The choices at once: a period back from today, from a year on, or without bounds. */
export const QUICK_CHOICES: readonly QuickChoice[] = [
	{ id: 'month', label: 'Afgelopen maand', from: (t) => maandenTerug(t, 1) },
	{ id: 'year', label: 'Afgelopen jaar', from: (t) => maandenTerug(t, 12) },
	{ id: 'five', label: 'Afgelopen 5 jaar', from: (t) => maandenTerug(t, 60) },
	{ id: 'since-2000', label: 'Sinds 2000', from: () => '2000-01-01' },
	{ id: 'all', label: 'Alle jaren', from: () => '' }
];

export const TO_BEFORE_FROM = 'Tot ligt voor van.';
const HINT = 'Typ een jaar of een datum als 1-3-2024.';

/** The day `months` months before `today`, the same day of the month where it exists. */
export function maandenTerug(today: string, months: number): string {
	const [y, m, d] = today.split('-').map(Number);
	const target = new Date(Date.UTC(y, m - 1 - months, 1));
	const last = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
	).getUTCDate();
	target.setUTCDate(Math.min(d, last));
	return target.toISOString().slice(0, 10);
}

/** Which quick choice a period is, or null for a period of its own. */
export function quickChoiceOf(from: string, to: string, today: string): string | null {
	if (to) return null;
	return QUICK_CHOICES.find((c) => c.from(today) === from)?.id ?? null;
}

/** A bound as the URL holds it: a day; anything else is no bound. */
export function alsDag(v: string | null | undefined): string | null {
	const s = (v ?? '').trim();
	return isDay(s) ? s : null;
}

/** `2024-03-01` as "1 mrt 2024". */
export function formatDay(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

type Side = 'from' | 'to';

/** The year a bound stands for, where it is a whole year's first day (from) or last (to). */
function wholeYear(iso: string, side: Side): string | null {
	const rest = iso.slice(4);
	return rest === (side === 'from' ? '-01-01' : '-12-31') ? iso.slice(0, 4) : null;
}

/** A bound as a field shows it: a year where it is a whole year's edge, else "1 mrt 2024". */
export const fieldText = (iso: string, side: Side): string =>
	iso ? (wholeYear(iso, side) ?? formatDay(iso)) : '';

/** A period in words; the name of a quick choice where it is one. */
export function periodInWords(from: string, to: string, today: string): string {
	if (!from && !to) return 'Alle jaren';
	const quick = QUICK_CHOICES.find((c) => c.id === quickChoiceOf(from, to, today));
	if (quick) return quick.label;
	const whole = (!from || wholeYear(from, 'from')) && (!to || wholeYear(to, 'to'));
	const say = (iso: string) => (whole ? iso.slice(0, 4) : formatDay(iso));
	const [a, b] = [from && say(from), to && say(to)];
	if (a && b) return `${a} tot ${b}`;
	return a ? `Sinds ${a}` : `Tot ${b}`;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** The month a word names: "mrt", "maart", "mrt." (the first three letters decide). */
function monthNumber(word: string): number {
	const w = word.toLowerCase().replace(/\.$/, '');
	if (w.length < 3) return 0;
	return MONTHS_SHORT.findIndex((k, i) => w === k || MONTHS[i].startsWith(w)) + 1;
}

/**
 * A typed bound: empty (no bound), a year (the first of January for from, the 31st of
 * December for to), or a date as 1-3-2024, 1/3/2024, 2024-03-01 or 1 mrt 2024.
 */
export function readBound(text: string, side: Side): { day: string } | { error: string } {
	const t = text.trim();
	if (!t) return { day: '' };
	if (/^\d{4}$/.test(t)) return { day: side === 'from' ? `${t}-01-01` : `${t}-12-31` };
	const numeric =
		/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})$/.exec(t) ??
		/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
	let d: number, m: number, y: number;
	if (numeric) {
		const iso = numeric[1].length === 4;
		const [a, b, c] = iso ? [numeric[3], numeric[2], numeric[1]] : numeric.slice(1);
		[d, m, y] = [Number(a), Number(b), Number(c)];
	} else {
		const named = /^(\d{1,2})\s+([a-zA-Z]{3,9}\.?)\s+(\d{4})$/.exec(t);
		if (!named || !monthNumber(named[2])) return { error: HINT };
		[d, m, y] = [Number(named[1]), monthNumber(named[2]), Number(named[3])];
	}
	if (m < 1 || m > 12 || d < 1) return { error: HINT };
	if (d > daysIn(y, m)) return { error: `${d} ${MONTHS[m - 1]} bestaat niet. ${HINT}` };
	return { day: `${y}-${pad(m)}-${pad(d)}` };
}
