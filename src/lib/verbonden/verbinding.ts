// One verbinding as an object: the two bronnen with the relation between them, the
// passage with the citation, betrouwbaarheid as a word with its reason, the status and
// the source of the edge. Built from a row of the panel or from an edge of the canvas.
import { paragraphAnchor } from '$lib/text/anchor';
import { refOf, type BronRef } from '$lib/bron/href';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import { statusLabel, type Collection, type Relation } from '$lib/vocabulary';
import { HERKOMST_REDEN, kleineLetter, relationLabel, soortVan } from './hoe';
import { paragraphCite } from '$lib/text/judgment-cite';
import { confidenceWord } from './filter';
import { describe, plaatsVanEdge, positionsLabel, type Row } from './rows';
import type { Bereik } from '$lib/text/voetnoten';
import { getNodeGraph, neighborsOf, type Neighbor } from '$lib/api/nodes';
import { NODE_TYPES } from '$lib/vocabulary';
import { keyEcli } from '$lib/bron/leesbaar';

export type End = {
	ref: BronRef;
	title: string;
	/** Under the title: identifier, position, date. */
	sub: string | null;
};

export type Verbinding = {
	from: End;
	to: End;
	relation: Relation;
	/** `haalt aan`, `licht toe`, `wijzigt`. */
	label: string;
	/** What the verbinding is, for the head of the card: `verwijzing in een uitspraak`. */
	kind: string;
	lid: string | null;
	position: string | null;
	/** The anchor in `from` at which the verbinding stands. */
	at: string | null;
	snippet: string | null;
	match: string | null;
	/** The note of `from` the citation stands in: `at` is its anchor then. */
	noot: { id: string; label: string | null } | null;
	/** The words of the citation by their offsets, where the edge keeps them (a Kamerstuk). */
	bereik: Bereik | null;
	confidence: number | null;
	derived: boolean;
	status: 'vastgesteld' | 'voorgesteld';
	/** Why the edge exists, as the pipeline wrote it. */
	reason: string | null;
	edgeId: string | null;
};

/** What the verbinding is, for the head of the card: the words of hoe.ts. */
export const kindOfVerbinding = (
	relation: Relation,
	sourceCollection: Collection,
	targetCollection?: Collection | null,
	meta?: Record<string, unknown> | null
): string => soortVan(relation, sourceCollection, targetCollection, meta);

/**
 * Whether the card says the status: only of a change of the law, where `voorgesteld` or
 * `vastgesteld` says whether the wetgever enacted it. Of a citation, a stuk in its dossier or
 * a vote it says nothing a jurist would read as such.
 */
export const toontStatus = (v: Pick<Verbinding, 'relation' | 'status'>): boolean =>
	v.status === 'voorgesteld' ||
	v.relation === 'AMENDS' ||
	v.relation === 'INTRODUCES' ||
	v.relation === 'REPEALS';

/** `hoog`, `matig` or `laag`, with the reason. */
export function betrouwbaarheid(
	confidence: number | null | undefined,
	derived: boolean,
	reason: string | null
): { word: 'hoog' | 'matig' | 'laag'; why: string } {
	// Where the reason is known, the words of the row's provenance (hoe.ts): a reference read
	// from the XML of wetten.overheid.nl is no recognition.
	const known = reason ? HERKOMST_REDEN[reason] : undefined;
	const why =
		reason === 'bwb_article' || reason === 'ecli'
			? 'de verwijzing is als geheel herkend in de tekst'
			: known
				? kleineLetter(known)
				: reason
					? 'herkend in de tekst'
					: derived
						? 'afgeleid uit het dossier of uit de tekst, niet uit een verwijzing'
						: 'gelezen uit de bron';
	return { word: confidenceWord(confidence, derived), why };
}

const endOfNode = (node: GraphNode): End => {
	const d = describe(
		node.collection,
		node.key,
		node.raw?.display_name ?? node.label,
		node.raw?.props ?? {}
	);
	return {
		ref: refOf(node.collection, node.key, node.raw?.props),
		// An article as it is cited, a BW one with its book: "Artikel 7:658 BW", not the
		// data's "Artikel 658 Burgerlijk Wetboek Boek 7".
		title: node.collection === 'articles' ? d.title : (node.raw?.display_name ?? d.title),
		sub: d.identifier ?? d.context
	};
};

export function verbindingOfRow(row: Row, selection: GraphNode): Verbinding | null {
	if (!row.relation) return null;
	const rowEnd: End = {
		ref: row.ref,
		title: row.title,
		sub: [row.position, row.identifier].filter(Boolean).join(', ') || null
	};
	const selected = endOfNode(selection);
	if (row.lid) selected.sub = `lid ${row.lid}`;
	const inbound = row.direction === 'inbound';
	const [from, to] = inbound ? [rowEnd, selected] : [selected, rowEnd];
	const sourceCollection = inbound ? row.ref.collection : selection.collection;
	const targetCollection = inbound ? selection.collection : row.ref.collection;
	return {
		from,
		to,
		relation: row.relation,
		label: relationLabel(row.relation, sourceCollection, targetCollection, row.edge),
		kind: kindOfVerbinding(row.relation, sourceCollection, targetCollection, row.edge),
		lid: row.lid ?? null,
		position: row.position ?? null,
		// The place in the citing text: its note, the row's own, or where the selected bron cites it.
		at: row.noot?.id ?? row.passageAt ?? (inbound ? (row.at ?? null) : null),
		snippet: row.snippet ?? null,
		match: row.match ?? null,
		noot: row.noot ?? null,
		bereik: row.bereik ?? null,
		confidence: row.confidence ?? null,
		derived: !!row.derived,
		status: row.proposed ? 'voorgesteld' : 'vastgesteld',
		// Why the edge exists is the edge's (`row.edge`), not the bron's props.
		reason: typeof row.edge?.reason === 'string' ? row.edge.reason : null,
		edgeId: row.edgeId ?? null
	};
}

/**
 * Where an edge stands in its source, from its meta: the light meta of a node's response
 * gives the numbers of the paragraphs (`paragraphs: ["6", "7"]`), one mention its own
 * (`paragraph_number`, `paragraph_id`). `r.o. 6 en 7` and the anchor of the first, so the
 * line, the card and its Lees open where the row does.
 */
export function plaatsVanMeta(
	meta: Record<string, unknown> | null | undefined,
	sourceKey: string
): { position: string | null; at: string | null } {
	const m = meta ?? {};
	const nummers = Array.isArray(m.paragraphs)
		? m.paragraphs.filter((p): p is string => typeof p === 'string' && !!p)
		: [];
	const een =
		typeof m.paragraph_number === 'string' && m.paragraph_number ? m.paragraph_number : null;
	const alle = nummers.length ? nummers : een ? [een] : [];
	const id = typeof m.paragraph_id === 'string' && m.paragraph_id ? m.paragraph_id : null;
	return {
		position: positionsLabel(alle.map((nr) => paragraphCite(sourceKey, nr))),
		at: id ?? (alle[0] ? paragraphAnchor(alle[0]) : null)
	};
}

export function verbindingOfEdge(
	edge: GraphEdge,
	source: GraphNode,
	target: GraphNode
): Verbinding {
	const meta = (edge.meta ?? {}) as Record<string, unknown>;
	const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
	const lid = (Array.isArray(meta.leden) && text(meta.leden[0])) || text(meta.lid) || null;
	const plaats = plaatsVanEdge(meta, ecliVan(source));
	return {
		from: endOfNode(source),
		to: endOfNode(target),
		relation: edge.relation,
		label: relationLabel(edge.relation, source.collection, target.collection, meta),
		kind: kindOfVerbinding(edge.relation, source.collection, target.collection, meta),
		lid,
		...plaatsVanMeta(meta, source.key),
		...(plaats.position ? { position: plaats.position } : {}),
		...(plaats.noot || plaats.passageAt ? { at: plaats.noot?.id ?? plaats.passageAt ?? null } : {}),
		snippet: plaats.snippet ?? text(meta.snippet),
		match: plaats.match ?? text(meta.raw_match),
		noot: plaats.noot ?? null,
		bereik: plaats.bereik ?? null,
		confidence: edge.confidence ?? null,
		derived: edge.confidence != null && edge.confidence < 1,
		status: statusLabel(edge.status) as 'vastgesteld' | 'voorgesteld',
		reason: text(meta.reason),
		edgeId: edge.id.startsWith('synth:') ? null : (text(meta.edge_id) ?? null)
	};
}

const ecliVan = (node: GraphNode) =>
	node.collection === 'judgments'
		? ((typeof node.raw?.props?.ecli === 'string' ? node.raw.props.ecli : null) ??
			keyEcli(node.key))
		: null;

/**
 * The card of a canvas edge with the place a judgment cites, which the canvas does not load
 * (`edge_meta=passages`, asked when the card opens): the neighbour the citing judgment's
 * bucket gives for the edge's other end.
 */
export function metPassages(v: Verbinding, source: GraphNode, n: Neighbor): Verbinding {
	const meta = (n.meta ?? {}) as Record<string, unknown>;
	const p = plaatsVanEdge(meta, ecliVan(source));
	if (!p.snippet) return v;
	return {
		...v,
		position: p.position ?? v.position,
		at: p.noot?.id ?? p.passageAt ?? v.at,
		snippet: p.snippet,
		match: p.match ?? v.match,
		noot: p.noot ?? null
	};
}

/**
 * The card of a canvas edge where a judgment cites, with its passage: the citing judgment's
 * bucket of that relation asked with `edge_meta=passages`. The card as it was otherwise.
 */
export async function kaartMetPassages(
	v: Verbinding,
	source: GraphNode,
	target: GraphNode,
	signal?: AbortSignal
): Promise<Verbinding> {
	if (source.collection !== 'judgments' || v.relation !== 'REFERS_TO' || v.snippet) return v;
	const r = await getNodeGraph(source.collection, source.key, {
		limit: 200,
		relations: v.relation,
		nodeTypes: NODE_TYPES[target.collection],
		direction: 'outbound',
		edgeMeta: 'passages',
		signal
	});
	const n = neighborsOf(r).find((x) => x.key === target.key && x.relation === v.relation);
	return n ? metPassages(v, source, n) : v;
}

/** What the reader marks where the card's Lees opens `from`: the note, the citation in it. */
export function markeringVan(v: Verbinding) {
	if (!v.at) return null;
	const cited = v.to.ref.collection;
	return {
		bron: `${v.from.ref.collection}/${v.from.ref.key}`,
		at: v.at,
		doel: cited === 'articles' || cited === 'judgments' ? v.to.ref.key : null,
		bereik: v.bereik
	};
}

/** `ECLI:NL:HR:2024:1769, r.o. 5.1`: how the source is cited at the position of the verbinding. */
export function citeVerbinding(v: Verbinding): string {
	const parts = [v.from.title, v.position].filter(Boolean);
	return parts.join(', ');
}
