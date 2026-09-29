// The division of a law above an article: book, hoofdstuk, titel, afdeling, as the API
// gives it in `breadcrumb`. Each layer is shown once; a layer that is the law itself
// (Boek 6 in Burgerlijk Wetboek Boek 6) is not a layer.

export type Division = {
	type?: string | null;
	/** As the law prints it: `Hoofdstuk 3`, `Titel 3.2`, `Eerste Boek`. */
	label?: string | null;
	/** The heading of the layer: `Algemene bepalingen over besluiten`. */
	title?: string | null;
};

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** The layers of a place, without a first one the name of the law already says. */
export function layersOf<D extends Division>(crumbs: D[], lawName: string | null | undefined): D[] {
	const law = norm(lawName);
	const first = norm(crumbs[0]?.label);
	return first && law.endsWith(` ${first}`) ? crumbs.slice(1) : crumbs;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The place of an article in one line: every layer by its designation, the innermost
 * with its heading. `Hoofdstuk 3, afdeling 3.2` and `Zorgvuldigheid en belangenafweging`.
 */
export function placeOf(
	crumbs: Division[],
	lawName: string | null | undefined
): { designation: string; title: string | null } | null {
	const layers = layersOf(crumbs, lawName).filter((c) => c.label?.trim());
	if (layers.length === 0) return null;
	const designation = layers
		.map((c, i) => (i === 0 ? c.label!.trim() : lowerFirst(c.label!.trim())))
		.join(', ');
	return { designation, title: layers.at(-1)?.title?.trim() || null };
}
