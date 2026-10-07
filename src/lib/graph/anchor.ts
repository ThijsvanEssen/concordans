// The anchor of a container (a wet, fractie, commissie or dossier) is a point its hull and
// the lines to the container end at. A composed netwerk draws one for a container its
// chosen bronnen share (`joins` in store/compose), with a line from each of them. When
// those bronnen are themselves in the container's hull (art. 3:4 and 3:2 in "Awb"), the
// point and its lines repeat what the hull says, and the point pulls the hull out of
// shape. Such an anchor is left out: no point, no lines, no place in the hull.

type Group = { members: ReadonlySet<string> };

export type AnchorInput = {
	/** The anchors on the canvas. */
	anchors: Iterable<string>;
	/** The groups a bron is a member of. */
	groupsOf: (id: string) => Iterable<Group>;
	/** The other ends of a bron's drawn verbindingen (not the layout-only ones). */
	neighboursOf: (id: string) => Iterable<string>;
	/** Whether a bron is drawn: not filtered out, not an anchor. */
	drawnMember: (id: string) => boolean;
};

/**
 * The anchors that add nothing to their hull: one of their groups holds a drawn bron
 * besides them, and every verbinding of the anchor goes to a member of its groups. An
 * anchor a bron outside the hull points at (a stuk that changes the wet) stays.
 */
export function redundantAnchors({
	anchors,
	groupsOf,
	neighboursOf,
	drawnMember
}: AnchorInput): Set<string> {
	const out = new Set<string>();
	for (const id of anchors) {
		const groups = [...groupsOf(id)];
		if (!groups.length) continue;
		const inHull = (other: string) => groups.some((g) => g.members.has(other));
		const held = groups.some((g) => [...g.members].some((m) => m !== id && drawnMember(m)));
		if (!held) continue;
		if ([...neighboursOf(id)].every(inHull)) out.add(id);
	}
	return out;
}
