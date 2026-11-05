// Where the bronnen of the keten stand and what they say: pure, so the drawing only draws
// (ChainView.svelte).
import type { ChainLayer, ChainNode } from '$lib/network/chain';
import { capitalize } from '$lib/text/words';

type Measures = {
	rest: Partial<Record<ChainLayer['id'], number>>;
	/** Where each layer begins, and the left edge and the whole width of the drawing. */
	tops: readonly number[];
	left: number;
	width: number;
	/** From a layer's top to its bronnen, and the room of a bron across. */
	drop: number;
	slot: number;
	/** Half the width of a name, in a layer of `n`. */
	halfOf: (k: ChainNode, n: number) => number;
};

/** The slot of the j-th bron of Noemt: 0, 1, -1, 2, -2…, with `before` slots to the left. */
const outward = (j: number, before: number) =>
	j > 2 * before ? j - before : j % 2 ? (j + 1) / 2 : -j / 2;

/**
 * Each node's row is its layer's; across, it stands under what it hangs from (the mean of its
 * parents' places), kept apart by a node's room and within the width, so the lines run down
 * rather than across each other (Thijs, Grondwet, 23 Oct). A layer without placed parents
 * spreads evenly.
 */
export function placeLayers(layers: readonly ChainLayer[], o: Measures) {
	const m = new Map<string, { x: number; y: number }>();
	const { left } = o;
	const end = Math.max(left + 200, o.width - 24);
	// A lone bron that a line passes over (the conclusie between the hof and the Hoge Raad) steps
	// aside, so the line does not run through its name.
	const rowOf = new Map<string, number>();
	layers.forEach((l, i) => l.nodes.forEach((k) => rowOf.set(k.id, i)));
	// Noemt comes late: its lines make no bron above it step aside.
	const bypassed = (i: number) =>
		layers
			.slice(i + 1)
			.some(
				(l) =>
					l.id !== 'named' && l.nodes.some((k) => k.parents.some((p) => (rowOf.get(p.id) ?? i) < i))
			);
	layers.forEach((layer, i) => {
		const n = layer.nodes.length;
		// Noemt fills out from under its law, a slot each: what comes late stands beyond what stands.
		if (layer.id === 'named') {
			const from = m.get(layer.nodes[0].parents[0]?.id)?.x ?? (left + end) / 2;
			const before = Math.max(0, Math.floor((from - left - o.slot / 2) / o.slot));
			layer.nodes.forEach((k, j) =>
				m.set(k.id, { x: from + outward(j, before) * o.slot, y: o.tops[i] + o.drop })
			);
			return;
		}
		// "N andere" stands a slot past the last: its room is kept.
		const right = o.rest[layer.id] ? end - o.slot : end;
		// Apart by a slot at most; a layer without a place above it is centred on the drawing.
		const sep = Math.min((right - left) / n, o.slot);
		const wish = layer.nodes.map((k, j) => {
			const at = k.parents.map((p) => m.get(p.id)?.x).filter((x): x is number => x !== undefined);
			return {
				k,
				x: at.length
					? at.reduce((a, b) => a + b, 0) / at.length
					: (left + right) / 2 + (j - (n - 1) / 2) * sep
			};
		});
		wish.sort((a, b) => a.x - b.x);
		// As near its wish as the room allows (pooled blocks, so a group stands centred under
		// what it hangs from), then within the drawing.
		const blocks: { sum: number; count: number; at: number }[] = [];
		wish.forEach((w, j) => {
			blocks.push({ sum: w.x - j * sep, count: 1, at: j });
			while (
				blocks.length > 1 &&
				blocks[blocks.length - 2].sum / blocks[blocks.length - 2].count >
					blocks[blocks.length - 1].sum / blocks[blocks.length - 1].count
			) {
				const last = blocks.pop()!;
				blocks[blocks.length - 1].sum += last.sum;
				blocks[blocks.length - 1].count += last.count;
			}
		});
		const xs = blocks.flatMap((b) =>
			Array.from({ length: b.count }, (_, i) => b.sum / b.count + (b.at + i) * sep)
		);
		const shift = Math.max(0, left + sep / 2 - xs[0]) || Math.min(0, right - sep / 2 - xs[n - 1]);
		for (let j = 0; j < n; j++) xs[j] += shift;
		// Half its name and some air, to the side that has room.
		const room = (layer.nodes[0] ? o.halfOf(layer.nodes[0], n) : 0) + 48;
		const aside = n === 1 && bypassed(i) ? (xs[0] + room <= right - 40 ? room : -room) : 0;
		// A name stays within the drawing, whichever side its node stands on.
		wish.forEach((w, j) => {
			const half = o.halfOf(w.k, n);
			const x = Math.min(Math.max(xs[j] + aside, half), Math.max(half, right + 24 - half));
			m.set(w.k.id, { x, y: o.tops[i] + o.drop });
		});
	});
	return m;
}

/** A name over as many lines as it takes, of at most `max` characters; never cut (Keten). */
export const linesOf = (s: string, max = 22) => {
	const out: string[] = [];
	for (const w of s.split(/\s+/)) {
		const last = out[out.length - 1];
		if (last && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`;
		else out.push(w);
	}
	return out;
};

/** The kind of what a layer holds, for its card of the others: "4 andere wetten". */
export const KIND_WORDS: Record<string, [string, string]> = {
	basis: ['wet', 'wetten'],
	law: ['wet', 'wetten'],
	named: ['wet', 'wetten'],
	implementation: ['wet', 'wetten'],
	eu: ['EU-akte', 'EU-akten'],
	amvb: ['AMvB', 'AMvB’s'],
	kb: ['koninklijk besluit', 'koninklijke besluiten'],
	ministerial: ['regeling', 'regelingen'],
	policy: ['beleidsregel', 'beleidsregels'],
	other: ['regeling', 'regelingen']
};

/** How a row of the list hangs: its seat or court, else its grondslag and what it names. */
export const howOf = (k: ChainNode) =>
	k.how ||
	capitalize(
		[
			k.grondslag ? `grondslag ${k.grondslag}` : null,
			k.mentions ? `noemt ${k.mentions}` : null,
			k.unknown ? `grondslag onbekend ${k.unknown}` : null
		]
			.filter(Boolean)
			.join(', ')
	) ||
	null;
/** The words of its grondslag: the articles it rests on, each with its law's abbreviation. */
export const grondslagOf = (k: ChainNode): string[] => [
	...(k.grondslag ? [`Grondslag ${k.grondslag}`] : []),
	...(k.mentions ? [`Noemt ${k.mentions}`] : []),
	...(k.unknown ? [`Grondslag onbekend ${k.unknown}`] : [])
];
