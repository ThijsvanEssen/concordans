// A period as a filter chip says it: one day or one year once, a period in the words of the
// Periode line (`Sinds 2020`, `2020 tot 2024`, `1 jan 2024 tot 30 jun 2024`).
import { vandaag } from '$lib/text/datum';
import { formatDay, periodInWords } from '$lib/text/periode';

type RangeUnit = 'year' | 'date';

/** A year as the days of its edges, as the line takes them. */
const edge = (value: string, side: 'from' | 'to', unit: RangeUnit) =>
	!value
		? ''
		: unit === 'year'
			? `${value.slice(0, 4)}-${side === 'from' ? '01-01' : '12-31'}`
			: value;

export function rangeLabel(from: string, to: string, unit: RangeUnit): string {
	const [a, b] = [edge(from, 'from', unit), edge(to, 'to', unit)];
	if (a && unit === 'year' && a.slice(0, 4) === b.slice(0, 4)) return a.slice(0, 4);
	if (a && unit === 'date' && from === to) return formatDay(from);
	return periodInWords(a, b, vandaag());
}
