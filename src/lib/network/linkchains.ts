// The verbindingsketens of Verband (DS Verband, "Aantal stappen"): from /api/chains, the rows
// of steps that join two chosen bronnen through laws and articles between them, a block per
// length (Twee stappen, Drie stappen). Pure, so the drawing on a wide screen and the numbered
// list on a phone read one model. Each tussenbron stands once, in the row of the first chain
// that reaches it; a later chain that touches it runs to that place.
import type { Schema } from '$lib/api/types';
import { relationWords } from '$lib/verbonden/relation-words';
import { rowNotation } from './shared';
import { formatCount } from '$lib/text/getal';
import { joinAnd } from '$lib/text/words';
import type { Collection, Relation } from '$lib/vocabulary';

export type ChainsResponse = Schema<'ChainsResponse'>;
type Edge = ChainsResponse['edges'][number];

/** The longest chain Verband asks for, and the shortest that needs /api/chains. */
export const MAX_STEPS = 3;
/** The most rows a block draws. */
export const MAX_ROWS = 12;
const BLOCK_TITLE: Record<number, string> = {
	1: 'Eén stap',
	2: 'Twee stappen',
	3: 'Drie stappen'
};

export type ChainBron = {
	id: string;
	name: string;
	collection: Collection | null;
	/** The node as the answer gives it, for the card of a bron; absent for an end it lacks. */
	node?: ChainsResponse['nodes'][number] | Schema<'SharedNeighborDTO'>;
};

/** One step: two bronnen, joined by a line between them or by what both touch (`via`). */
export type ChainStep = {
	from: ChainBron;
	to: ChainBron;
	/** What both share (a Kamerstuk that names both); null where one refers to the other. */
	via: ChainBron | null;
	/** How it joins, in words: `noemt beide`, `verwijst naar`. */
	text: string;
	/** The same for the phone: `beide genoemd in 35133, nr. 3 Memorie van toelichting`. */
	phone: string;
	/** How strong it is (API 0.80.13): its line is this times 3 px thick; null: its kind's. */
	weight: number | null;
	/** Its lines, in the style of their kind: one, or two by way of `via`. */
	legs: StepLeg[];
	/** The step as the phone says it: `Waterschapswet en Woningwet`. */
	pair: string;
};

export type ChainRow = {
	id: string;
	/** The ends and the tussenbronnen, in order. */
	bronnen: ChainBron[];
	steps: ChainStep[];
	/** Of one step with more than two chosen bronnen: the ends beyond the second, each with its line. */
	also?: { bron: ChainBron; leg: StepLeg }[];
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

type ChainsModel = {
	ends: [ChainBron, ChainBron];
	blocks: ChainBlock[];
	/** Every bron on the rows, each once: the kenmerken and the tussenbronnen, for a card. */
	known: Map<string, ChainBron>;
	/** Some block is not complete: a missing chain does not mean none. */
	incomplete: boolean;
	/** No chain in any block. */
	none: boolean;
};

/** A Kamerstuk by its notation, as the shared bronnen are, else the API's name. */
const nameOf = (n: ChainsResponse['nodes'][number]) => rowNotation(n).title;

/** One line of a step: its relation, the kind it comes from and the end its arrow points to. */
export type StepLeg = {
	relation: Relation | null;
	from: Collection | null;
	/** The arrow at the start or at the end of the leg; null where the line has none. */
	arrow: 'start' | 'end' | null;
};

type Wording = { text: string; phone: string; legs: StepLeg[] };

/**
 * How a step joins, in words and in lines (DS Verband): the verb of its line; where one bron
 * names both, `noemt beide` and on a phone `beide genoemd in …`; where the lines differ, the
 * verb of each. Its lines are the edges: one between the sources, or two by way of `via`.
 */
function wording(
	step: ChainsResponse['blocks'][number]['chains'][number]['steps'][number],
	edges: ReadonlyMap<string, Edge>,
	bron: (id: string) => ChainBron
): Wording {
	const lines = step.edge_ids.map((id) => edges.get(id)).filter((e): e is Edge => !!e);
	const words = (e: Edge) =>
		relationWords(
			(e.relation ?? 'RELATED_TO') as Relation,
			bron(e.source).collection,
			bron(e.target).collection
		);
	const leg = (e: Edge | undefined, a: string, b: string): StepLeg => ({
		relation: e ? ((e.relation ?? 'RELATED_TO') as Relation) : null,
		from: e ? bron(e.source).collection : null,
		arrow: !e ? null : e.target === b ? 'end' : e.target === a ? 'start' : null
	});
	if (!step.via) {
		const text = lines[0] ? words(lines[0]).actief : 'verbindt';
		return { text, phone: text, legs: [leg(lines[0], step.source, step.target)] };
	}
	const [first, second] = lines;
	const legs = [leg(first, step.source, step.via), leg(second, step.via, step.target)];
	const via = bron(step.via).name;
	if (first && second) {
		const [x, y] = [words(first), words(second)];
		const same = first.relation === second.relation;
		if (first.source === step.via && second.source === step.via)
			return same
				? { text: `${x.actief} beide`, phone: `beide ${x.terug} in ${via}`, legs }
				: { text: `${x.actief} en ${y.actief}`, phone: `${via} ${x.actief} en ${y.actief}`, legs };
		if (first.target === step.via && second.target === step.via)
			return same
				? { text: `${x.terug} door beide`, phone: `${via}, ${x.terug} door beide`, legs }
				: { text: `${x.terug} en ${y.terug}`, phone: `${via}, ${x.terug} en ${y.terug}`, legs };
		return {
			text: `${x.actief} en ${y.actief}`,
			phone: `${via}, ${x.actief} en ${y.actief}`,
			legs
		};
	}
	return { text: 'verbindt', phone: via, legs };
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
	const known: ChainsModel['known'] = new Map();
	const blocks = response.blocks
		.filter((b) => b.steps >= 2 && b.steps <= steps)
		.sort((x, y) => x.steps - y.steps)
		.map((b): ChainBlock => {
			// A chain is as strong as its weakest step (its `weight`); equal, by id.
			const rows = [...b.chains]
				.sort((x, y) => y.weight - x.weight || x.node_ids.join().localeCompare(y.node_ids.join()))
				.slice(0, MAX_ROWS)
				.map((c): ChainRow => {
					const bronnen = c.node_ids.map(bron);
					for (const n of bronnen.slice(1, -1)) known.set(n.id, n);
					return {
						id: c.node_ids.join('~'),
						bronnen,
						steps: c.steps.map((s) => {
							const via = s.via ? bron(s.via) : null;
							if (via) known.set(via.id, via);
							return {
								from: bron(s.source),
								to: bron(s.target),
								via,
								weight: s.weight,
								...wording(s, edges, bron),
								pair: joinAnd([bron(s.source).name, bron(s.target).name])
							};
						})
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
		known,
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
