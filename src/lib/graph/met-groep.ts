// A grouping switched off takes along what is in it (Thijs, 9 Oct: "Als het dossier
// gedeselecteerd wordt moeten alle dingen in het dossier ook verdwijnen"). Reality is not one
// to one: a bron that is also in view by a route of its own stays.
import type { ContainerGroup, ContainerKind } from './container-membership';

/**
 * The bronnen hidden with a grouping that is off, each with the kind of that grouping: the
 * members of its hulls, unless a bron is in a hull still on, is kept itself, or has a line
 * of its own to a bron that is kept (a stuk that changes the focused article). The
 * container itself (the dossier) is no such route: its line is the membership.
 */
export function metGroepVerborgen(opts: {
	groups: Iterable<ContainerGroup>;
	/** The groupings switched off. */
	uit: ReadonlySet<string>;
	/** Never hidden, and a route for the others: the focus and the chosen bronnen. */
	houd: (id: string) => boolean;
	/** The ends of a bron's lines. */
	buren: (id: string) => Iterable<string>;
	/** A container's own bron (the dossier), drawn as its hull. */
	anker: (id: string) => boolean;
}): Map<string, ContainerKind> {
	const kandidaten = new Map<string, ContainerKind>();
	const aan = new Set<string>();
	const ankers = new Set<string>();
	for (const group of opts.groups) {
		for (const id of group.members) {
			if (!opts.uit.has(group.kind)) aan.add(id);
			else {
				if (opts.anker(id)) ankers.add(id);
				if (!kandidaten.has(id) && !opts.houd(id)) kandidaten.set(id, group.kind);
			}
		}
	}
	for (const id of aan) kandidaten.delete(id);
	for (const id of [...kandidaten.keys()]) {
		if (ankers.has(id)) continue;
		for (const n of opts.buren(id)) {
			if (opts.houd(n) && !ankers.has(n)) {
				kandidaten.delete(id);
				break;
			}
		}
	}
	return kandidaten;
}
