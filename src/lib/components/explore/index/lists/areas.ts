// Rechtsgebied as a tree, for the laws (the TOOI thesaurus of the BWB) and the judgments (the
// Rechtspraak's register), and a facet of values as the source names them.
import type { FacetGroup } from '../IndexFacets.svelte';
import type { ListContext } from './list';

/** A main area with its specific areas, as a register gives them with their counts. */
export type Area = { id: string; label: string; count: number; narrower: Omit<Area, 'narrower'>[] };

/**
 * A choice the register does not hold (an old link, a value with no bronnen under the
 * other filters) stays in the list with 0, so it can be seen and let go of.
 */
export const keepChosen = (areas: Area[], key: string) => {
	if (!areas.some((a) => a.id === key || a.narrower.some((n) => n.id === key)))
		areas.unshift({ id: key, label: key, count: 0, narrower: [] });
};

/**
 * Rechtsgebied as a tree: the main areas with their counts, and under the chosen one its
 * specific areas, indented. A main area alone holds its specific areas; a specific area
 * narrows it. Both registers give the tree themselves (`narrower`).
 */
export function areaTree(
	areas: Area[],
	chosenMain: string,
	chosenSub: string,
	choose: (main: string | null, sub: string | null) => void,
	/** A long register (the 27 of the BWB) shows this many main areas, then Alle N. */
	preview?: number
): FacetGroup[] {
	const options = areas.flatMap((a) => {
		const on = chosenMain === a.id;
		return [
			{
				id: `area-${a.id}`,
				label: a.label,
				count: a.count,
				// Chosen while one of its specific areas narrows it; a click lets go of both.
				on,
				onClick: () => choose(on ? null : a.id, null)
			},
			...(on
				? a.narrower.map((n) => ({
						id: n.id,
						label: n.label,
						count: n.count,
						indent: true as const,
						on: chosenSub === n.id,
						onClick: () => choose(a.id, chosenSub === n.id ? null : n.id)
					}))
				: [])
		];
	});
	return options.length
		? [{ id: 'area', label: 'Rechtsgebied', kind: 'list', open: true, preview, options }]
		: [];
}

/**
 * A facet of the list as the source names its values (rechtsgebied, procedure), most
 * bronnen first; the API counts it without its own filter. A bron without the value
 * cannot be chosen by it and is left out. One value at a time.
 */
export function sourceFacet(
	patch: ListContext<unknown, object>['patch'],
	param: 'subject' | 'procedure',
	label: string,
	facet: { value?: string | null; count: number }[] | null | undefined,
	current: string
): FacetGroup[] {
	const toggle = (value: string) => () => patch({ [param]: current === value ? null : value });
	const options = (facet ?? []).flatMap((f) =>
		f.value
			? [
					{
						id: f.value,
						label: f.value,
						count: f.count,
						on: current === f.value,
						onClick: toggle(f.value)
					}
				]
			: []
	);
	if (current && !options.some((o) => o.on))
		options.unshift({ id: current, label: current, count: 0, on: true, onClick: toggle(current) });
	// No counts yet, or an API without the facet: no group, rather than an empty heading.
	return options.length ? [{ id: param, label, kind: 'list', preview: 6, options }] : [];
}
