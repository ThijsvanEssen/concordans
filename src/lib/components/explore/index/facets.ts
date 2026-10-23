// The filters of a list as FilterBar draws them (besluit 40, A205 variant A, the FilterBalk): per dimension
// its options, each with the number of bronnen it holds under the other filters; a period;
// a choice. Groups that share a `knop` stand under one button of the bar, each as a section
// of its menu (the courts under Instantie, in the order of the judiciary).
import { rangeLabel } from './range';

type FacetOption = {
	id: string;
	label: string;
	on: boolean;
	onClick: () => void;
	count?: number | string;
	swatch?: string;
	/** Under an option of the same group: a specific area under its rechtsgebied. */
	indent?: boolean;
	/** What holds without a choice (the open dossiers): on, but not shown as a filter. */
	default?: boolean;
};

export type FacetGroup = {
	id: string;
	label: string;
	note?: string;
	/** The button of the bar it stands under, where that is not its own label (Instantie). */
	button?: string;
} & (
	| {
			kind: 'list';
			/** Names what a chosen option is in its chip, where its label alone is ambiguous. */
			chip?: string;
			options: FacetOption[];
	  }
	| {
			kind: 'select';
			value: string;
			/** No choice, as the option it was in a select (`Alle ministeries`). */
			all: string;
			options: { value: string; label: string; count?: number }[];
			onChange: (v: string) => void;
	  }
	| {
			kind: 'range';
			/** `year` keeps a year, `date` a day, as the URL holds them. */
			unit: 'year' | 'date';
			from: string;
			to: string;
			onChange: (from: string, to: string) => void;
	  }
	| { kind: 'text'; value: string; placeholder: string; onChange: (v: string) => void }
	| {
			/** One of a few, always one chosen: a choice, not a filter. */
			kind: 'keuze';
			value: string;
			/** `titel` names the option in full where its label is short (Tweede: Tweede Kamer). */
			options: { value: string; label: string; titel?: string }[];
			onChange: (v: string) => void;
	  }
);

/**
 * A menu's options from its counts, the chosen value among them though the counts lack it
 * (not in yet, or partial): by its name, never its key (#136).
 */
export const selectOptions = (
	counts: Map<string, number>,
	chosen: string,
	name: (key: string) => string
): { value: string; label: string; count?: number }[] => [
	...(chosen && !counts.has(chosen) ? [{ value: chosen, label: name(chosen) }] : []),
	...[...counts].map(([key, count]) => ({ value: key, label: name(key), count }))
];

/** A filter that is on, as a chip above the list; `short` its value alone (`Hoge Raad`). */
type ActiveFilter = { id: string; label: string; short: string; onRemove: () => void };

/** Every filter that is on in these groups, in their order. */
export function activeFilters(groups: FacetGroup[]): ActiveFilter[] {
	return groups.flatMap((g): ActiveFilter[] => {
		switch (g.kind) {
			case 'list':
				return g.options.flatMap((o) =>
					!o.on || o.default
						? []
						: [
								{
									id: `${g.id}:${o.id}`,
									label: g.chip ? `${g.chip}: ${o.label}` : o.label,
									short: o.label,
									onRemove: o.onClick
								}
							]
				);
			case 'range': {
				if (!g.from && !g.to) return [];
				const short = rangeLabel(g.from, g.to, g.unit);
				return [
					{ id: g.id, label: `${g.label}: ${short}`, short, onRemove: () => g.onChange('', '') }
				];
			}
			case 'select': {
				const on = g.options.find((o) => o.value === g.value);
				return on
					? [
							{
								id: g.id,
								label: `${g.label}: ${on.label}`,
								short: on.label,
								onRemove: () => g.onChange('')
							}
						]
					: [];
			}
			case 'text':
				return g.value
					? [
							{
								id: g.id,
								label: `${g.label}: ${g.value}`,
								short: g.value,
								onRemove: () => g.onChange('')
							}
						]
					: [];
			// A choice, not a filter: no chip.
			case 'keuze':
				return [];
		}
	});
}

/** A button of the bar: its name and the groups in its menu. */
export type FacetButton = { id: string; label: string; groups: FacetGroup[] };

/** Every period is Periode on its button; its own name heads its menu (In werking getreden). */
const PERIOD = 'Periode';

/** The buttons of their own in the bar: the first two filters of a list and Periode. */
const BAR_OWN = 3;

const buttonOf = (g: FacetGroup) => (g.kind === 'range' ? PERIOD : (g.button ?? g.label));

/**
 * The buttons of the groups, in their order, the groups that share a button under the first:
 * the period third (after the two first filters of the list), as in every list.
 */
export function facetButtons(groups: FacetGroup[]): FacetButton[] {
	const out: FacetButton[] = [];
	for (const g of groups) {
		const label = buttonOf(g);
		const at = out.find((b) => b.label === label);
		if (at) at.groups.push(g);
		else out.push({ id: g.id, label, groups: [g] });
	}
	const period = out.findIndex((b) => b.label === PERIOD);
	if (period < 0) return out;
	const [p] = out.splice(period, 1);
	out.splice(Math.min(2, out.length), 0, p);
	return out;
}

/**
 * The bar: the first BAR_OWN buttons, the rest under Meer. By their place, not their number,
 * so a group whose counts come late changes what Meer holds, never the row.
 */
export function barLayout(groups: FacetGroup[]): { bar: FacetButton[]; more: FacetButton[] } {
	const all = facetButtons(groups);
	return { bar: all.slice(0, BAR_OWN), more: all.slice(BAR_OWN) };
}

/** Whether a group's own name heads it in its menu: not where the button says it already. */
export const headed = (button: FacetButton, g: FacetGroup) =>
	button.groups.length > 1 || g.label !== button.label;

/** A list longer than this gets a field to find an option by its name (Stuksoort: 115). */
export const FIND_FROM = 12;
