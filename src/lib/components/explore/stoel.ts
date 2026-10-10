// How a seat of the hall shows one stemming: its fractie's side, or faded where the fractie took
// no part. A vacant seat is nobody's vote: it shows none, whatever its fractie voted (UX-toets
// 0.79.44, #39: the empty D66 seat on kabinet-Schoof read "tegen").

export type Kant = 'voor' | 'tegen' | 'other';

/** The side of a seat on the vote shown; null: no vote shown, or a vacant seat. */
export function stemVanStoel(
	stoel: { leeg?: boolean; faction: { key?: string | null } },
	stemming: Record<string, Kant> | null | undefined
): Kant | 'niet' | null {
	if (!stemming || stoel.leeg) return null;
	const key = stoel.faction.key;
	return (key ? stemming[key] : undefined) ?? 'niet';
}
