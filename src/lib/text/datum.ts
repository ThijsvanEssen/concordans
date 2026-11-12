// Every date Concordans shows, in one place. A date from the API is an ISO day
// (`2026-09-28`) or a moment (`2026-09-28T10:00:00Z`); only its day counts, read as
// written, so no time zone moves it to the day before.
//
//   korteDatum   28 sep. 2026        in lists, rows and columns
//   dagMaand     28 sep.             in a timeline whose group names the year
//   maandJaar    sep. 2026           in an axis or a period
//   langeDatum   28 september 2026   in a sentence or a citation
//   weekdag      Dinsdag 28 september 2026, as a heading over a day
//   the choice: langeDatum in a sentence or a heading, korteDatum in a list, a row, a column
//   or a bar; never both in one block (E9 A)
//   sinceDate   sinds 28 september 2026; so asOfDate, onDate, fromDate, untilDate and
//                throughDate: a word before a date in a sentence is written here only,
//                and always with the long date (guards/datum.test.ts)
//   yearsOf      2017–2021, 2025– in a column, sinds 2025 in a sentence: every span of years
//   periodSentence  sinds 23 feb. 2026, 2 jul. 2024 tot 23 feb. 2026: every period in words
//
// The parts of a date are joined by a no-break space, so a line never breaks inside it.

import { capitalize } from './words';
import { NOT_IN_DATA } from './coverage';

/** The months, lower case, January first. */
export const MONTHS = [
	'januari',
	'februari',
	'maart',
	'april',
	'mei',
	'juni',
	'juli',
	'augustus',
	'september',
	'oktober',
	'november',
	'december'
];
// The Taalunie's abbreviations: a full stop, except for mei; maart is mrt.
export const MAAND_KORT = [
	'jan.',
	'feb.',
	'mrt.',
	'apr.',
	'mei',
	'jun.',
	'jul.',
	'aug.',
	'sep.',
	'okt.',
	'nov.',
	'dec.'
];
const NBSP = '\u00a0';
const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

const DATE_IN_TEXT = new RegExp(
	`\\b(\\d{1,2})[ \\u00a0](${MONTHS.join('|')})(?:[ \\u00a0](\\d{4}))?\\b`,
	'gi'
);

/** A text with the dates in its words held together: `12 maart 2020` never breaks over two lines.
 *  A space for a no-break space, so every offset in the text stays. */
export const holdDatesTogether = (text: string): string =>
	text.replace(DATE_IN_TEXT, (d) => d.replaceAll(' ', NBSP));

/** A text cut at its dates: `12 maart 2020` a part of its own, for a nowrap span. The parts
 *  joined are the text, so no offset moves and nothing in the text changes. */
export const splitDates = (text: string): { text: string; date: boolean }[] => {
	const parts: { text: string; date: boolean }[] = [];
	let start = 0;
	for (const m of text.matchAll(DATE_IN_TEXT)) {
		if (m.index > start) parts.push({ text: text.slice(start, m.index), date: false });
		parts.push({ text: m[0], date: true });
		start = m.index + m[0].length;
	}
	if (start < text.length) parts.push({ text: text.slice(start), date: false });
	return parts;
};

/** A text with its long dates written short: `HR 20 december 2019` becomes `HR 20 dec. 2019`.
 *  For a name in a list, on the canvas and in the keten (besluit 7); a heading or a sentence
 *  keeps its long date. */
export const shortDatesIn = (text: string): string =>
	text.replace(DATE_IN_TEXT, (_all, d: string, month: string, year?: string) => {
		const abbr = MAAND_KORT[MONTHS.indexOf(month.toLowerCase())];
		return `${d}${NBSP}${abbr}${year ? NBSP + year : ''}`;
	});

type Dag = { j: number; m: number; d: number };

/** The day an ISO date or moment names, or null when it names none. */
export function dagVan(iso: string | null | undefined): Dag | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
	if (!m) return null;
	const dag = { j: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
	return dag.m >= 1 && dag.m <= 12 && dag.d >= 1 && dag.d <= 31 ? dag : null;
}

/** The year of an ISO date or moment, `2026`; empty without one. */
export const yearOf = (iso: string | null | undefined): string =>
	/^\d{4}/.exec(iso ?? '')?.[0] ?? '';

/** `28 sep. 2026`; empty without a date. Without `fullStop` the month has no full stop, `28 sep 2026`:
 *  as a reader types a bound of a period. */
export const korteDatum = (iso: string | null | undefined, { fullStop = true } = {}): string => {
	const t = dagVan(iso);
	if (!t) return '';
	const month = MAAND_KORT[t.m - 1];
	return `${t.d}${NBSP}${fullStop ? month : month.replace('.', '')}${NBSP}${t.j}`;
};

/** `28 sep.`; empty without a date. */
export const dagMaand = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${t.d}${NBSP}${MAAND_KORT[t.m - 1]}` : '';
};

/** The month alone, `september` or, `kort`, `sep.`: over the days of a timetable. */
export const monthName = (iso: string | null | undefined, kort = false): string => {
	const t = dagVan(iso);
	return t ? (kort ? MAAND_KORT : MONTHS)[t.m - 1] : '';
};

/** `sep. 2026`; empty without a date. */
export const maandJaar = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${MAAND_KORT[t.m - 1]}${NBSP}${t.j}` : '';
};

/** `28 september 2026`; empty without a date. */
export const langeDatum = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${t.d}${NBSP}${MONTHS[t.m - 1]}${NBSP}${t.j}` : '';
};

/** `Dinsdag 28 september 2026`; empty without a date. */
export const weekdag = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	if (!t) return '';
	const w = WEEKDAG[new Date(Date.UTC(t.j, t.m - 1, t.d)).getUTCDay()];
	return `${capitalize(w)} ${langeDatum(iso)}`;
};

const withWord =
	(woord: string) =>
	(iso: string | null | undefined): string => {
		const d = langeDatum(iso);
		return d ? `${woord} ${d}` : '';
	};

/** `sinds 28 september 2026`; empty without a date. */
export const sinceDate = withWord('sinds');
/** `per 28 september 2026`; empty without a date. */
export const asOfDate = withWord('per');
/** `op 28 september 2026`; empty without a date. */
export const onDate = withWord('op');
/** `vanaf 28 september 2026`; empty without a date. */
export const fromDate = withWord('vanaf');
/** `tot 28 september 2026`; empty without a date. */
export const untilDate = withWord('tot');
/** `tot en met 28 september 2026`; empty without a date. */
export const throughDate = withWord('tot en met');

/** `beslist 28 september 2026`: the day a court decided; empty without a date. */
export const decidedDate = withWord('beslist');

/** A day as the URL and the API write it, `2015-01-01`, and one the calendar has. */
export const isDay = (s: string | null | undefined): s is string =>
	!!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** The milliseconds of a day. */
export const DAY_MS = 86_400_000;

/** The days from `a` to `b`, ISO dates or moments; negative when `b` comes first. */
export const daysBetween = (a: string, b: string): number =>
	(Date.parse(b) - Date.parse(a)) / DAY_MS;

/** The ISO day `n` days after `iso` (before it for a negative `n`). */
export const addDays = (iso: string, n: number): string =>
	new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** The day of a moment in the Netherlands, where the law and the Kamer date their days. */
const AMSTERDAM = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Amsterdam',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

/** Today as an ISO day, in Europe/Amsterdam: the day the page, a citation and a peildatum say. */
export const vandaag = (now = new Date()): string => AMSTERDAM.format(now);

/** The Monday of the week of an ISO day, as an ISO day. */
export function maandagVan(dag: string): string {
	const d = new Date(`${dag}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d.toISOString().slice(0, 10);
}

/** Whether the ISO day has come: today or before (in Europe/Amsterdam). */
export const hasPassed = (iso: string, now = new Date()): boolean => iso <= vandaag(now);

type YearsForm = {
	/** `kolom`: a year first, so a column of them aligns, `2025–`; `zin`: in a sentence, `sinds 2025`. */
	form?: 'kolom' | 'zin';
	/** Whether a period without an end still runs; else its end is one the sources do not give. */
	open?: boolean;
};

/**
 * The years of a period, one dash without spaces: `2017–2026`, `2026`, and while it lasts
 * `2025–` (kolom) or `sinds 2025` (zin). Without a start `–2021` or `tot en met 2021`; an end
 * the sources do not give (not `open`) says so: `1913, einde niet in de gegevens`.
 */
export function yearsOf(
	from: string | null | undefined,
	to: string | null | undefined,
	{ form = 'kolom', open = true }: YearsForm = {}
): string {
	const [a, b] = [yearOf(from), yearOf(to)];
	if (a && b) return a === b ? a : `${a}–${b}`;
	if (a && !open) return `${a}, einde ${NOT_IN_DATA}`;
	const sentence = form === 'zin';
	if (a) return sentence ? `sinds ${a}` : `${a}–`;
	return b ? (sentence ? `tot en met ${b}` : `–${b}`) : '';
}

/**
 * A period in a sentence: `sinds 23 feb. 2026` while it runs (no end, or one still to come),
 * `2 jul. 2024 tot 23 feb. 2026`, `tot 23 feb. 2026` without a start. The dates `kort` (in a
 * list, a bar), `lang` (in a sentence of a reader) or by `maand` (`feb. 2026`, on a time line).
 */
export function periodSentence(
	from: string | null | undefined,
	to: string | null | undefined,
	form: 'kort' | 'lang' | 'maand' = 'kort',
	today = vandaag()
): string {
	const date = { kort: korteDatum, lang: langeDatum, maand: maandJaar }[form];
	if (!dagVan(from)) return dagVan(to) ? `tot ${date(to)}` : `periode ${NOT_IN_DATA}`;
	if (!to || !dagVan(to) || to >= today) return `sinds ${date(from)}`;
	return `${date(from)} tot ${date(to)}`;
}

/** The day after an ISO day. */
export const nextDay = (iso: string): string => addDays(iso, 1);

/** The ISO week of a day: its Thursday's year and the week's number, `{ year: 2026, week: 41 }`. */
export function isoWeek(day: string): { year: number; week: number } {
	const thursday = addDays(maandagVan(day.slice(0, 10)), 3);
	const year = Number(thursday.slice(0, 4));
	const week = Math.ceil((daysBetween(`${year}-01-01`, thursday) + 1) / 7);
	return { year, week };
}

/** The Monday of week `week` of ISO year `year`, as a day; the 4th of January is in week 1. */
export const mondayOfWeek = (year: number, week: number): string =>
	addDays(maandagVan(`${year}-01-04`), (week - 1) * 7);

/** The last day of a month (`m` 1 to 12), as an ISO day. */
export const lastDayOfMonth = (year: number, m: number): string =>
	new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

/** The years from `a` to `b` (today without `b`), ISO dates: a period's length on a time line. */
export const yearsBetween = (a: string | null | undefined, b?: string | null): number =>
	daysBetween(a ?? '', b ?? vandaag()) / 365.25;

/** Today as a reader dates a consultation: `22 oktober 2026`. */
export const consultedOn = (now = new Date()): string => langeDatum(vandaag(now));

/** A day as a year and its fraction, `2006-03-01` as 2006.16: where it stands on a time line. */
export const yearFraction = (iso: string): number => {
	const [j, m = 1, d = 1] = iso.split('-').map(Number);
	return j + ((m - 1) * 31 + d - 1) / 372;
};
