// How a seat of the hall shows one stemming: its fractie's side, or faded where the fractie took
// no part. A vacant seat is nobody's vote: it shows none, whatever its fractie voted (UX-toets
// 0.79.44, #39: the empty D66 seat on kabinet-Schoof read "tegen").

export type Kant = 'voor' | 'tegen' | 'other';

/** The side of a seat on the vote shown; null: no vote shown, or a vacant seat. */
export function stemVanStoel(
	stoel: { leeg?: boolean; faction: { key?: string | null } | null },
	stemming: Record<string, Kant> | null | undefined
): Kant | 'niet' | null {
	if (!stemming || stoel.leeg) return null;
	const key = stoel.faction?.key;
	return (key ? stemming[key] : undefined) ?? 'niet';
}

/** The seats per row of the hall, inner to outer: 150 for the Tweede Kamer, 75 for the Eerste. */
export const RIJEN_150 = [12, 18, 18, 24, 24, 24, 30];
export const RIJEN_75 = [6, 12, 12, 12, 15, 18];

/**
 * The places of the hall dealt out in their order: each fractie its held seats, then its
 * vacant ones empty beside them (UX test 10 Oct, #12); after all fracties the vacant seats no
 * fractie holds (`los`, UX #48), empty and of none. Never more seats than places.
 */
export function deelStoelen<P extends object, F extends { seats: number; vacant?: number | null }>(
	plekken: P[],
	fracties: F[],
	los = 0
): (P & { faction: F | null; leeg?: boolean })[] {
	const out: (P & { faction: F | null; leeg?: boolean })[] = [];
	let i = 0;
	const zet = (n: number, faction: F | null, leeg: boolean) => {
		for (let k = 0; k < n && i < plekken.length; k++)
			out.push({ ...plekken[i++], faction, ...(leeg ? { leeg } : {}) });
	};
	for (const f of fracties) {
		zet(f.seats, f, false);
		zet(f.vacant ?? 0, f, true);
	}
	zet(los, null, true);
	return out;
}
