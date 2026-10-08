// A grouping switched off takes along what is in it (Thijs, 9 Oct: "Als het dossier
// gedeselecteerd wordt moeten alle dingen in het dossier ook verdwijnen", and again: "dan
// blijven de stukken in het dossier nog staan, dat wilde we juist niet"). Being in it wins:
// a chosen stuk of the dossier, or one with a line of its own, goes too. Only what is
// outside it stays.
import type { ContainerGroup, ContainerKind } from './container-membership';

/**
 * The bronnen hidden with a grouping that is off, each with the kind of that grouping: every
 * member of its hulls, chosen or not, unless it is in a hull still on or is the focus itself
 * (a stuk opened stays as what is opened).
 */
export function metGroepVerborgen(opts: {
	groups: Iterable<ContainerGroup>;
	/** The groupings switched off. */
	uit: ReadonlySet<string>;
	/** Never hidden: the focus. */
	houd: (id: string) => boolean;
}): Map<string, ContainerKind> {
	const verborgen = new Map<string, ContainerKind>();
	const aan = new Set<string>();
	for (const group of opts.groups) {
		for (const id of group.members) {
			if (!opts.uit.has(group.kind)) aan.add(id);
			else if (!verborgen.has(id) && !opts.houd(id)) verborgen.set(id, group.kind);
		}
	}
	for (const id of aan) verborgen.delete(id);
	return verborgen;
}
