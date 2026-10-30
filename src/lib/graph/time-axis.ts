// The axis of Tijd: in Kamerstukken and Rechtspraak the height is the date. Only a year in which
// something stands there gets height; a run of empty years is one bend of BEND px without a year,
// and months are marked only on a short axis, where a year is tall enough to read them.
import { maandNaam, yearFraction } from '$lib/text/datum';

/** The height of a run of empty years: a bend, without a year. */
const BEND = 14;

/** The height of a year: the axis shares this out, within these bounds. */
const AXIS_SPAN = 760;
const YEAR_MIN = 60;
const YEAR_MAX = 300;

/** A year this tall marks its months (on a short axis). */
const MONTHS_FROM = 200;

/** Years `from` up to (not including) `to`: one busy year, or a run of empty ones. */
type AxisSegment = { from: number; to: number; y: number; height: number; empty: boolean };

type AxisTick = { y: number; label: string; kind: 'year' | 'month' };

export type TimeAxis = { top: number; bottom: number; segments: AxisSegment[]; ticks: AxisTick[] };

/** A day as a year with its fraction (`yearFraction`); null without one. */
const yearOf = (day: string | null): number | null =>
	day && /^\d{4}/.test(day) ? yearFraction(day) : null;

/** The years from the first to the last day, each busy one alone, each run of empty ones as one. */
function segmentsOf(years: readonly number[]): { from: number; to: number; empty: boolean }[] {
	const busy = new Set(years.map(Math.floor));
	const first = Math.floor(Math.min(...years));
	const last = Math.floor(Math.max(...years));
	const out: { from: number; to: number; empty: boolean }[] = [];
	for (let year = first; year <= last; ) {
		let end = year + 1;
		if (!busy.has(year)) while (end <= last && !busy.has(end)) end++;
		out.push({ from: year, to: end, empty: !busy.has(year) });
		year = end;
	}
	return out;
}

/** The ticks: a year at the start of each busy one and at the end, the months of a tall year. */
function axisTicks(segments: readonly AxisSegment[], bottom: number): AxisTick[] {
	const ticks: AxisTick[] = [];
	for (const s of segments) {
		if (s.empty) continue;
		ticks.push({ y: s.y, label: String(s.from), kind: 'year' });
		if (s.height < MONTHS_FROM) continue;
		for (const month of [3, 6, 9])
			ticks.push({
				y: s.y + (s.height * month) / 12,
				label: maandNaam(`${s.from}-${String(month + 1).padStart(2, '0')}-01`, true),
				kind: 'month'
			});
	}
	const end = segments.at(-1);
	if (end) ticks.push({ y: bottom, label: String(end.to), kind: 'year' });
	return ticks;
}

/** The axis for the days on it, from `top` down; null without a day. */
export function timeAxis(days: readonly (string | null)[], top: number): TimeAxis | null {
	const years = days.map(yearOf).filter((y): y is number => y !== null);
	if (years.length === 0) return null;
	const parts = segmentsOf(years);
	const busy = parts.filter((p) => !p.empty).length;
	const perYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX, AXIS_SPAN / busy));
	let y = top;
	const segments = parts.map((p) => {
		const height = p.empty ? BEND : perYear;
		const segment = { ...p, y, height };
		y += height;
		return segment;
	});
	return { top, bottom: y, segments, ticks: axisTicks(segments, y) };
}

/** The height of a day on the axis; a day in an empty run stands at its bend. */
export function axisY(axis: TimeAxis, day: string | null): number | null {
	const year = yearOf(day);
	if (year === null) return null;
	const s = axis.segments.find((g) => year >= g.from && year < g.to) ?? axis.segments.at(-1)!;
	if (year < s.from) return axis.top;
	return s.empty ? s.y : Math.min(s.y + (year - s.from) * s.height, s.y + s.height);
}
