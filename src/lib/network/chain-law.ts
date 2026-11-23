// How the laws of a keten stand over and beside each other by their kind: pure, so chain.ts only
// builds the layers.
import type { ChainLayer, ChainNode } from '$lib/network/chain';

/** How high a kind stands: the Grondwet over the wet, the wet over the AMvB, and so down. */
const RANK: Record<string, number> = {
	grondwet: 0,
	wet: 1,
	rijkswet: 1,
	amvb: 2,
	rijksamvb: 2,
	kb: 3,
	rijkskb: 3,
	'ministeriele-regeling': 4,
	beleidsregel: 5
};
export const rankOf = (kind: string | null | undefined) => RANK[(kind ?? '').toLowerCase()] ?? 6;

/**
 * The wetten that only name the law: over a regulation, in the layer Wet of the laws it rests
 * on, each with its dashed line down to it; under the Grondwet, a layer Wet of their own. Still
 * being asked: the layer they will stand in keeps its place.
 */
export function nameLaw(
	naming: ChainNode[],
	o: {
		kind: string | null;
		lawLayer: ChainLayer;
		layers: ChainLayer[];
		ups: { rank: number; layer: ChainLayer }[];
		wetLane: boolean;
		awaiting: boolean;
		mentions: boolean;
	}
) {
	const waits = o.awaiting && o.mentions;
	const over = !o.wetLane && rankOf(o.kind) > RANK.wet;
	let up = o.ups.find((u) => u.layer.id === 'statute');
	if (naming.length && over) {
		const focus = o.lawLayer.nodes[0];
		for (const n of naming) {
			focus.parents.push(...n.parents.map((p) => ({ ...p, id: n.id })));
			n.parents = [];
		}
	}
	if (naming.length && !over) o.layers.push({ id: 'statute', label: 'Wet', nodes: naming });
	else if (naming.length || (waits && over)) {
		if (!up)
			o.ups.push(
				(up = {
					rank: RANK.wet,
					layer: { id: 'statute', label: 'Wet', above: true, nodes: [] }
				})
			);
		up.layer.nodes.push(...naming);
		if (!naming.length) up.layer.awaiting = true;
	} else if (waits && o.wetLane) o.lawLayer.awaiting = true;
}

/**
 * Who of a layer is drawn first where not all fit: what hangs under the bron marked, then one by
 * one per parent, so a row is not filled by what hangs directly under the law and the wetten
 * beside it keep their regulations (B86). A parent not on the drawing waits a turn: a line first.
 */
export function fillOrder(
	all: readonly ChainNode[],
	onDrawing: ReadonlySet<string>,
	keep: string | null
): ChainNode[] {
	const turns = new Map<string, number>();
	const turnOf = new Map(
		all.map((n) => {
			if (n.parents.some((p) => p.id === keep)) return [n, -1];
			// The last parent is the one furthest from the law.
			const drawn = n.parents.findLast((p) => onDrawing.has(p.id))?.id;
			const parent = drawn ?? n.parents[0]?.id ?? '';
			const turn = turns.get(parent) ?? (drawn ? 0 : 1);
			turns.set(parent, turn + 1);
			return [n, turn];
		})
	);
	return [...all].sort((a, b) => turnOf.get(a)! - turnOf.get(b)!);
}
