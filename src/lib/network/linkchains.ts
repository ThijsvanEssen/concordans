// The verbindingsketens of Verband (DS Verband, "Aantal stappen"): from /api/chains, the rows
// of steps that join two chosen bronnen through laws and articles between them, a block per
// length (Twee stappen, Drie stappen). Pure, so the drawing on a wide screen and the numbered
// list on a phone read one model. Each tussenbron stands once, in the row of the first chain
// that reaches it; a later chain that touches it runs to that place.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { relationWords } from '$lib/verbonden/relation-words';
import { formatCount } from '$lib/text/getal';
import { joinAnd } from '$lib/text/words';
import type { Collection, Relation } from '$lib/vocabulary';

export type ChainsResponse = Schema<'ChainsResponse'>;
type Edge = ChainsResponse['edges'][number];

/** The longest chain Verband asks for, and the shortest that needs /api/chains. */
export const MAX_STEPS = 3;
export const BLOCK_TITLE: Record<number, string> = {
	1: 'Eén stap',
	2: 'Twee stappen',
	3: 'Drie stappen'
};

export type ChainBron = {
	id: string;
	name: string;
	collection: Collection | null;
	/** The node as the answer gives it, for the card of a tussenbron; null for an end it lacks. */
	node?: ChainsResponse['nodes'][number];
};

/** One step: two bronnen, joined by a line between them or by what both touch (`via`). */
export type ChainStep = {
	from: ChainBron;
	to: ChainBron;
	/** What both share (a Kamerstuk that names both); null where one refers to the other. */
	via: ChainBron | null;
	/** How it joins, in words: `noemt beide`, `verwijst naar`. */
	text: string;
	/** The step as the phone says it: `Waterschapswet en Woningwet`. */
	pair: string;
};

export type ChainRow = {
	id: string;
	/** The ends and the tussenbronnen, in order. */
	bronnen: ChainBron[];
	steps: ChainStep[];
};

export type ChainBlock = {
	steps: number;
	title: string;
	rows: ChainRow[];
	/** Chains of this length the search found. */
	total: number;
	/** The search read all this length needs; false: it ran out of time or hit a cap. */
	complete: boolean;
	/** Of the rows drawn: `12 van 67 ketens`, `ten minste 12 ketens`; null where all are drawn. */
	count: string | null;
};

export type ChainsModel = {
	ends: [ChainBron, ChainBron];
	blocks: ChainBlock[];
	/** The tussenbronnen, each once: where its first chain puts it. */
	between: Map<string, { bron: ChainBron; block: number; row: number; at: number }>;
	/** Some block is not complete: a missing chain does not mean none. */
	incomplete: boolean;
	/** No chain in any block. */
	none: boolean;
};

const nameOf = (n: { id: string; display_name?: string | null }) => naamVanId(n.id, n.display_name);

/** The way a step joins: the verb of its line, `noemt beide` where one bron names both. */
function stepText(
	step: ChainsResponse['blocks'][number]['chains'][number]['steps'][number],
	edges: ReadonlyMap<string, Edge>,
	collections: (id: string) => Collection | null
): string {
	const lines = step.edge_ids.map((id) => edges.get(id)).filter((e): e is Edge => !!e);
	const words = (e: Edge) =>
		relationWords(
			(e.relation ?? 'RELATED_TO') as Relation,
			collections(e.source),
			collections(e.target)
		).actief;
	if (!step.via) return lines[0] ? words(lines[0]) : 'verbindt';
	const [first, second] = lines;
	// The shared bron names (or cites) both: `noemt beide`.
	if (first && second && first.source === step.via && second.source === step.via) {
		const [a, b] = [words(first), words(second)];
		if (a === b) return `${a} beide`;
	}
	return 'gedeeld';
}

/**
 * The model of /api/chains for the pair `ends`: the blocks of 2 up to `steps` (one step is
 * what /api/nodes/shared shows). `names` knows the chosen bronnen, the answer its own nodes.
 */
export function chainsModel(
	response: ChainsResponse,
	ends: readonly [string, string],
	names: (id: string) => ChainBron,
	steps = MAX_STEPS
): ChainsModel {
	const nodes = new Map(response.nodes.map((n) => [n.id, n]));
	const edges = new Map(response.edges.map((e) => [e.id, e]));
	const bron = (id: string): ChainBron => {
		const n = nodes.get(id);
		const known = names(id);
		return n ? { id, name: nameOf(n), collection: n.collection as Collection, node: n } : known;
	};
	const collections = (id: string) => bron(id).collection;
	const between: ChainsModel['between'] = new Map();
	const blocks = response.blocks
		.filter((b) => b.steps >= 2 && b.steps <= steps)
		.sort((x, y) => x.steps - y.steps)
		.map((b, block): ChainBlock => {
			const rows = b.chains.map((c, row): ChainRow => {
				const bronnen = c.node_ids.map(bron);
				bronnen.slice(1, -1).forEach((n, i) => {
					if (!between.has(n.id)) between.set(n.id, { bron: n, block, row, at: i + 1 });
				});
				return {
					id: c.node_ids.join('~'),
					bronnen,
					steps: c.steps.map((s) => ({
						from: bron(s.source),
						to: bron(s.target),
						via: s.via ? bron(s.via) : null,
						text: stepText(s, edges, collections),
						pair: joinAnd([bron(s.source).name, bron(s.target).name])
					}))
				};
			});
			const complete = b.complete && !response.partial;
			return {
				steps: b.steps,
				title: BLOCK_TITLE[b.steps] ?? `${b.steps} stappen`,
				rows,
				total: b.total,
				complete,
				count: countOf(rows.length, b.total, complete)
			};
		});
	return {
		ends: [bron(ends[0]), bron(ends[1])],
		blocks,
		between,
		incomplete: blocks.some((b) => !b.complete),
		none: blocks.every((b) => b.rows.length === 0)
	};
}

/** What is drawn of what was found: `12 van 67 ketens`; incomplete, `ten minste 12 ketens`. */
export function countOf(shown: number, total: number, complete: boolean): string | null {
	if (complete)
		return shown < total ? `${formatCount(shown)} van ${formatCount(total)} ketens` : null;
	if (total === 0) return null;
	return shown < total
		? `${formatCount(shown)} van ten minste ${formatCount(total)} ketens`
		: `ten minste ${formatCount(total)} ketens`;
}

/** What the page knows of the chains of the pair: on its way, failed, or in. */
export type ChainsState =
	| { status: 'loading' }
	| { status: 'error'; error: unknown; retry: () => void }
	| { status: 'ready'; model: ChainsModel };

/** The drawing's name, which says the chains in words (for a screen reader). */
export function chainsLabel(model: ChainsModel): string {
	const all = model.blocks.flatMap((b) => b.rows.map((r) => ({ r, n: b.steps })));
	const rows = all.slice(0, 5);
	if (rows.length === 0)
		return `Verbindingsketens tussen ${joinAnd(model.ends.map((e) => e.name))}`;
	return `Verbindingsketens tussen ${joinAnd(model.ends.map((e) => e.name))}: ${rows
		.map(
			({ r, n }) => `${BLOCK_TITLE[n].toLowerCase()}, ${r.bronnen.map((b) => b.name).join(', ')}`
		)
		.join('; ')}${all.length > rows.length ? `; en ${all.length - rows.length} andere` : ''}`;
}
