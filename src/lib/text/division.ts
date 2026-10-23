// The division of a law above an article: book, hoofdstuk, titel, afdeling, as the API
// gives it in `breadcrumb`. Each layer is shown once; a layer that is the law itself
// (Boek 6 in Burgerlijk Wetboek Boek 6) is not a layer.

import { lowerFirst } from './words';
import { formatAnchor, parseAnchor } from './anchor';

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

/**
 * The layers that begin at an article of a law read whole (`cur`, after `prev`), each once,
 * with its depth: a layer that is the law itself (Boek 6 of Burgerlijk Wetboek Boek 6) is no
 * heading.
 */
export function newSections<D extends Division & { anchor?: string | null }>(
	prev: { breadcrumb?: D[] | null } | undefined,
	cur: { breadcrumb?: D[] | null },
	lawName: string | null | undefined
): (D & { depth: number; id: string | null | undefined })[] {
	const before = layersOf(prev?.breadcrumb ?? [], lawName);
	return layersOf(cur.breadcrumb ?? [], lawName)
		.map((crumb, depth) => ({ ...crumb, depth, id: crumb.anchor }))
		.filter((crumb, i) => before[i]?.label !== crumb.label || before[i]?.type !== crumb.type);
}

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

const slug = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, '-')
		.replace(/^-+|-+$/g, '');

/**
 * The anchor of each layer in the whole law, by the path of labels down to it:
 * `deel-hoofdstuk-3-afdeling-3.2`. One per crumb, over the whole breadcrumb. The lists of a
 * law give it as each crumb's `anchor`; this is for the breadcrumb of an article node's
 * props, which has none (the band Behoort bij), by the same rule (text-rules.json).
 */
export function deelIds(crumbs: Division[]): string[] {
	const path: string[] = [];
	return crumbs.map((c) => {
		path.push(slug(c.label ?? c.title ?? ''));
		return formatAnchor({ kind: 'division', path: path.filter(Boolean).join('-') });
	});
}

/** The anchor of an article in the whole law, by its number as the BWB has it: `artikel-658`. */
export const artikelAnker = (number: string) => formatAnchor({ kind: 'article', number });

/** An article of the list of a law, as far as an anchor in the whole law names it. */
type Plek = {
	article_number?: string | null;
	address?: string | null;
	breadcrumb?: { anchor: string }[] | null;
};

/**
 * Where in the list of a law an anchor of the whole law stands: the article it names
 * (`artikel-658`), or the first article of the division (`deel-hoofdstuk-3`). -1 for none.
 */
export function plekVan(items: Plek[], anker: string): number {
	const a = parseAnchor(anker);
	if (a?.kind === 'article')
		return items.findIndex((item) => (item.article_number ?? item.address) === a.number);
	if (a?.kind === 'division')
		return items.findIndex((item) => item.breadcrumb?.some((c) => c.anchor === anker));
	return -1;
}
