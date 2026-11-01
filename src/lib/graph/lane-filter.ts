// What the lanes draw of the store under the bronfilter (Tijdstrook, rechter): a Kamerstuk or a
// judgment outside the period and a judgment of another court leave the scene, with their lines.
// Wetten, dossiers and makers stay: they are what the stukken hang on. The canvas of now
// dims them; the lanes have no dimmed unit, so a dossier shrinks to what lies in the period.
// The chosen bronnen always stay, so the choice can be undone.
import { stripDate } from '$lib/bron/strook';
import type { GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import { rechterOf, type Court } from '$lib/verbonden/filter';
import type { Period } from './container-membership';

/** The stream the Tijdstrook counts by day. */
const DATED: ReadonlySet<Collection> = new Set(['documents', 'judgments']);

/** The bronfilter as the lanes read it: the Tijdstrook's period and the rechter. */
export type LaneFilter = { period: Period | null; court: Court | null };

const outside = (day: string | null, p: Period | null) =>
	!!day && !!p && ((p.from !== null && day < p.from) || (p.to !== null && day > p.to));

const otherCourt = (n: GraphNode, court: Court | null) =>
	court !== null &&
	n.collection === 'judgments' &&
	rechterOf({
		identifier: typeof n.raw?.props?.ecli === 'string' ? n.raw.props.ecli : null,
		props: n.raw?.props ?? undefined,
		ref: { collection: 'judgments', key: n.key }
	}) !== court;

/** The nodes the lanes draw under the bronfilter. */
export function laneFiltered(
	nodes: readonly GraphNode[],
	f: LaneFilter,
	keep: readonly string[]
): readonly GraphNode[] {
	if (!f.period && !f.court) return nodes;
	const kept = new Set(keep);
	return nodes.filter((n) => {
		if (kept.has(n.id) || !DATED.has(n.collection as Collection)) return true;
		const day = stripDate(n.raw?.props, n.collection as Collection, n.id)?.slice(0, 10) ?? null;
		return !outside(day, f.period) && !otherCourt(n, f.court);
	});
}
