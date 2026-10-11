// The kinds of a focus's direct neighbours loaded in full ("Alle laden", the Legenda's per-kind
// step), so that a later neighbourhood around the same focus ("Alles laden", a cap of 2.000)
// keeps them instead of drawing them back to its share of the cap (Thijs, 11 Oct).

export type Bucket = { collection: string; total: number; kept: number };

/** Per focus, the ids each kind brought in through the per-kind step. */
export type SoortenGeladen = { focal: string; perSoort: Map<string, Set<string>> };

/** Records `ids` of `soort` for `focal`; another focus starts over. */
export function meldSoort(
	huidig: SoortenGeladen | null,
	focal: string,
	soort: string,
	ids: Iterable<string>
): SoortenGeladen {
	const basis = huidig && huidig.focal === focal ? huidig : { focal, perSoort: new Map() };
	const set = new Set(basis.perSoort.get(soort) ?? []);
	for (const id of ids) set.add(id);
	basis.perSoort.set(soort, set);
	return basis;
}

/** The ids to keep for a neighbourhood around `focal`: those of its kinds loaded in full. */
export function behoudenIds(huidig: SoortenGeladen | null, focal: string): Set<string> {
	const ids = new Set<string>();
	if (!huidig || huidig.focal !== focal) return ids;
	for (const set of huidig.perSoort.values()) for (const id of set) ids.add(id);
	return ids;
}

/** A neighbourhood's buckets with the kinds loaded in full counted as they stand. */
export function behoudenBuckets(
	buckets: Bucket[],
	huidig: SoortenGeladen | null,
	focal: string
): Bucket[] {
	if (!huidig || huidig.focal !== focal) return buckets;
	return buckets.map((b) => {
		const n = huidig.perSoort.get(b.collection)?.size ?? 0;
		return n > b.kept ? { ...b, kept: Math.min(n, b.total) } : b;
	});
}
