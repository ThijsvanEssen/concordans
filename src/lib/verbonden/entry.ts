// The way into Verbonden on a phone, where Verbonden stands behind its tab: how many there are
// and the largest soorten, in the numbers of the head of Verbonden (panelKinds, kindsTotal).
import { formatCount } from '$lib/text/getal';
import { joinParts, plural } from '$lib/text/words';
import type { Collection } from '$lib/vocabulary';
import type { Group } from './groups';
import { SORT_NAMES, kindsOf, kindsTotal, type Kind } from './summary';
import { isOwnGroup, panelSettled } from './view';
import type { VerbondenState } from './data-source';

/** The soorten a line names: more no longer fits one line of a phone. */
const LARGEST = 2;

/** Verbonden of a bron as it is loaded, for what reads it beside the panel. */
export type Connections = VerbondenState;

type Entry = { total: number; line: string };

/** The largest soorten with their counts: `11.183 uitspraken, 121 stukken`. */
export const largestKinds = (kinds: readonly Pick<Kind, 'id' | 'count'>[]): string =>
	joinParts(
		kinds
			.filter((k) => k.count > 0)
			.toSorted((a, b) => b.count - a.count)
			.slice(0, LARGEST)
			.map((k) => {
				const { one, many } = SORT_NAMES[k.id];
				return `${formatCount(k.count)} ${plural(k.count, one, many)}`;
			})
	);

/**
 * What the way in says of this bron, once every group is in so no number springs; null before
 * that and where there is nothing to name. `context` is what the panel counts (panel-groups).
 */
export function entryOf(
	v: Connections,
	collection: Collection,
	id: string,
	context: readonly Group[] | null
): Entry | null {
	if (v.id !== id || !context || !panelSettled(v)) return null;
	const kinds = kindsOf(
		context,
		collection,
		v.buckets,
		v.groups.filter((g) => isOwnGroup(collection, g))
	);
	const total = kindsTotal(kinds);
	return total > 0 ? { total, line: largestKinds(kinds) } : null;
}
