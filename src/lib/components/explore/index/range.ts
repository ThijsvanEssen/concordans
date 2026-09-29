// A period as a filter chip says it: one day or one year once, a period from and to.

export type RangeUnit = 'year' | 'date';

const shown = (value: string, unit: RangeUnit) =>
	!value
		? ''
		: unit === 'year'
			? value.slice(0, 4)
			: new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(value));

/** `22 sep. 2026`, `2020 tot 2024`, `… tot 2024`, `2020 tot nu`. */
export function rangeLabel(from: string, to: string, unit: RangeUnit): string {
	const a = shown(from, unit);
	const b = shown(to, unit);
	if (a && a === b) return a;
	return `${a || '…'} tot ${b || 'nu'}`;
}
