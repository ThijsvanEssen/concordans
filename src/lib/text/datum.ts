// Every date Concordans shows, in one place. A date from the API is an ISO day
// (`2026-09-28`) or a moment (`2026-09-28T10:00:00Z`); only its day counts, read as
// written, so no time zone moves it to the day before.
//
//   korteDatum   28 sep. 2026        in lists, rows and columns
//   dagMaand     28 sep.             in a timeline whose group names the year
//   maandJaar    sep. 2026           in an axis or a period
//   langeDatum   28 september 2026   in a sentence or a citation
//   weekdag      Dinsdag 28 september 2026, as a heading over a day

import { capitalize } from './words';

const MAAND = [
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
const MAAND_KORT = [
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
const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

type Dag = { j: number; m: number; d: number };

/** The day an ISO date or moment names, or null when it names none. */
export function dagVan(iso: string | null | undefined): Dag | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
	if (!m) return null;
	const dag = { j: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
	return dag.m >= 1 && dag.m <= 12 && dag.d >= 1 && dag.d <= 31 ? dag : null;
}

/** `28 sep. 2026`; empty without a date. */
export const korteDatum = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${t.d} ${MAAND_KORT[t.m - 1]} ${t.j}` : '';
};

/** `28 sep.`; empty without a date. */
export const dagMaand = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${t.d} ${MAAND_KORT[t.m - 1]}` : '';
};

/** The month alone, `september` or, `kort`, `sep.`: over the days of a timetable. */
export const maandNaam = (iso: string | null | undefined, kort = false): string => {
	const t = dagVan(iso);
	return t ? (kort ? MAAND_KORT : MAAND)[t.m - 1] : '';
};

/** `sep. 2026`; empty without a date. */
export const maandJaar = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${MAAND_KORT[t.m - 1]} ${t.j}` : '';
};

/** `28 september 2026`; empty without a date. */
export const langeDatum = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	return t ? `${t.d} ${MAAND[t.m - 1]} ${t.j}` : '';
};

/** `Dinsdag 28 september 2026`; empty without a date. */
export const weekdag = (iso: string | null | undefined): string => {
	const t = dagVan(iso);
	if (!t) return '';
	const w = WEEKDAG[new Date(Date.UTC(t.j, t.m - 1, t.d)).getUTCDay()];
	return `${capitalize(w)} ${langeDatum(iso)}`;
};

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

/** Today as an ISO day, in the reader's own time zone. */
export const vandaag = (now = new Date()): string =>
	`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** `2017–2026`, `2026`, `2025–` while it lasts: a year first, so a column of them aligns. */
export function yearsOf(from: string | null, to: string | null): string {
	const a = from?.slice(0, 4);
	const b = to?.slice(0, 4);
	if (a && b) return a === b ? a : `${a}–${b}`;
	return a ? `${a}–` : b ? `–${b}` : '';
}
