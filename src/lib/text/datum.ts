// Every date Concordans shows, in one place. A date from the API is an ISO day
// (`2026-09-28`) or a moment (`2026-09-28T10:00:00Z`); only its day counts, read as
// written, so no time zone moves it to the day before.
//
//   korteDatum   28 sep. 2026        in lists, rows and columns
//   dagMaand     28 sep.             in a timeline whose group names the year
//   maandJaar    sep. 2026           in an axis or a period
//   langeDatum   28 september 2026   in a sentence or a citation
//   weekdag      Dinsdag 28 september 2026, as a heading over a day

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
	return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${langeDatum(iso)}`;
};

/** Today as an ISO day, in the reader's own time zone. */
export const vandaag = (now = new Date()): string =>
	`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
