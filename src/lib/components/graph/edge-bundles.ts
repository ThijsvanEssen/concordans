/**
 * Which lines of the canvas wait for a hover because they only repeat a hull: several lines
 * from one bron into one hull are one line at rest (nine stukken of a dossier changing 44
 * articles of the Sr draw one line each into the Sr, not 116). A line between two bronnen
 * the reader chose (a netwerk, a map) is never one of those: what ties the chosen bronnen
 * is drawn in full.
 */

/** A line of the graph: its id and its two ends, in the direction of the line. */
export interface Lijn {
	id: string;
	source: string;
	target: string;
}

export interface Bundels {
	/** `bron|group` for a bron outside every hull: how many lines it draws into that hull. */
	linesIntoGroup: Map<string, number>;
	/** `bron|group` for any bron into a hull it is not in: how many, and the one that stands for them. */
	bundles: Map<string, { count: number; first: string }>;
}

export function telBundels(
	lijnen: Iterable<Lijn>,
	nodeGroupIds: ReadonlyMap<string, ReadonlySet<string>>
): Bundels {
	const linesIntoGroup = new Map<string, number>();
	const bundles = new Map<string, { count: number; first: string }>();
	for (const { id, source, target } of lijnen) {
		// In the direction of the line: a stuk into the articles it changes, a judgment
		// into the articles it cites. The articles are carried by their hull.
		const own = nodeGroupIds.get(source);
		for (const group of nodeGroupIds.get(target) ?? []) {
			if (own?.has(group)) continue;
			const key = `${source}|${group}`;
			const b = bundles.get(key);
			if (b) b.count++;
			else bundles.set(key, { count: 1, first: id });
		}
		for (const [from, to] of [
			[source, target],
			[target, source]
		]) {
			if (nodeGroupIds.has(from)) continue;
			for (const group of nodeGroupIds.get(to) ?? [])
				linesIntoGroup.set(`${from}|${group}`, (linesIntoGroup.get(`${from}|${group}`) ?? 0) + 1);
		}
	}
	return { linesIntoGroup, bundles };
}

/** Whether both ends of a line are bronnen the reader chose. */
const tussenGekozen = (src: string, tgt: string, chosen: ReadonlySet<string>) =>
	chosen.has(src) && chosen.has(tgt);

/** Whether a line is one of several from a bron into the same hull, and not the one that
 *  stands for them: it waits for a hover. Never between two chosen bronnen. */
export function bundledInto(
	lijn: Lijn,
	{ bundles }: Bundels,
	nodeGroupIds: ReadonlyMap<string, ReadonlySet<string>>,
	chosen: ReadonlySet<string>
): boolean {
	const { id, source, target } = lijn;
	if (tussenGekozen(source, target, chosen)) return false;
	let bundled = false;
	const own = nodeGroupIds.get(source);
	for (const group of nodeGroupIds.get(target) ?? []) {
		if (own?.has(group)) continue;
		const b = bundles.get(`${source}|${group}`);
		if (!b || b.count === 1 || b.first === id) return false;
		bundled = true;
	}
	return bundled;
}

function inSameGroup(
	a: string,
	b: string,
	nodeGroupIds: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
	const groupsOfA = nodeGroupIds.get(a);
	const groupsOfB = nodeGroupIds.get(b);
	if (!groupsOfA || !groupsOfB) return false;
	for (const id of groupsOfA) if (groupsOfB.has(id)) return true;
	return false;
}

/** Whether a line between two bronnen, neither the focus, only repeats a hull. Never
 *  between two chosen bronnen. */
export function repeatsHull(
	src: string,
	tgt: string,
	{ linesIntoGroup }: Bundels,
	nodeGroupIds: ReadonlyMap<string, ReadonlySet<string>>,
	chosen: ReadonlySet<string>
): boolean {
	if (tussenGekozen(src, tgt, chosen)) return false;
	if (inSameGroup(src, tgt, nodeGroupIds)) return true;
	const inA = nodeGroupIds.has(src);
	const inB = nodeGroupIds.has(tgt);
	// Between two hulls the line says why the other one is there (art. 126uba Sv → Sr).
	if (inA && inB) return false;
	const [outside, inside] = inA ? [tgt, src] : [src, tgt];
	return [...(nodeGroupIds.get(inside) ?? [])].some(
		(group) => (linesIntoGroup.get(`${outside}|${group}`) ?? 0) > 1
	);
}
