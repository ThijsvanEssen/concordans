// One verbinding as an object: the two bronnen with the relation between them, the
// passage with the citation, betrouwbaarheid as a word with its reason, the status and
// the source of the edge. Built from a row of the panel or from an edge of the canvas.
import { textOf } from '$lib/text/words';
import { refId, refOf, type BronRef } from '$lib/bron/href';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import { isAmendingRelation, statusLabel, type Relation } from '$lib/vocabulary';
import { HERKOMST_REDEN, kleineLetter, relationLabel, soortVan } from './hoe';
import { confidenceWord } from './filter';
import { describe, type Row } from './rows';
import { edgeKey, isDerived, plaatsVanEdge, readEdge } from './edge-meta';
import type { Bereik } from '$lib/text/voetnoten';
import { getNodeGraph, neighborsOf, NODE_BUCKET, type Neighbor } from '$lib/api/nodes';
import { NODE_TYPES } from '$lib/vocabulary';
import { keyEcli } from '$lib/bron/leesbaar';
import { ifExists, report } from '$lib/api/errors';
import { getCitedBy } from '$lib/api/verbonden';
import { CITED_BY_PAGE, rowsOfCitedBy } from './cited-by';

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

/**
 * Whether the card says the status: only of a change of the law, where `voorgesteld` or
 * `vastgesteld` says whether the wetgever enacted it. Of a citation, a stuk in its dossier or
 * a vote it says nothing a jurist would read as such.
 */
export const toontStatus = (v: Pick<Verbinding, 'relation' | 'status'>): boolean =>
	v.status === 'voorgesteld' || isAmendingRelation(v.relation);

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
		// data's "Artikel 658 Burgerlijk Wetboek Boek 7"; a judgment as its row names it, not
		// "Rechtbank Den Haag 2013-01-01 / 000000-00".
		title:
			node.collection === 'articles' || node.collection === 'judgments'
				? d.title
				: (node.raw?.display_name ?? d.title),
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
		kind: soortVan(row.relation, sourceCollection, targetCollection, row.edge),
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
		reason: textOf(row.edge?.reason),
		edgeId: row.edgeId ?? null
	};
}

export function verbindingOfEdge(
	edge: GraphEdge,
	source: GraphNode,
	target: GraphNode
): Verbinding {
	const meta = (edge.meta ?? {}) as Record<string, unknown>;
	// The edge's source cites: the canvas card reads it as the row of its target does.
	const read = readEdge(meta, { direction: 'inbound', citingEcli: ecliOf(source) });
	return {
		from: endOfNode(source),
		to: endOfNode(target),
		relation: edge.relation,
		label: relationLabel(edge.relation, source.collection, target.collection, meta),
		kind: soortVan(edge.relation, source.collection, target.collection, meta),
		lid: read.lid,
		position: read.position,
		at: read.at,
		snippet: read.snippet,
		match: read.match,
		noot: read.noot,
		bereik: read.bereik,
		confidence: edge.confidence ?? null,
		derived: isDerived(edge.confidence),
		status: statusLabel(edge.status) as 'vastgesteld' | 'voorgesteld',
		reason: read.reason,
		edgeId: edge.id.startsWith('synth:') ? null : textOf(meta.edge_id)
	};
}

const ecliOf = (node: GraphNode) =>
	node.collection === 'judgments'
		? ((typeof node.raw?.props?.ecli === 'string' ? node.raw.props.ecli : null) ??
			keyEcli(node.key))
		: null;

/**
 * The card of a canvas edge with the place a judgment cites, which the canvas does not load
 * (`edge_meta=passages`, asked when the card opens): the neighbour the citing judgment's
 * bucket gives for the edge's other end.
 */
function metPassages(v: Verbinding, source: GraphNode, n: Neighbor): Verbinding {
	const p = plaatsVanEdge((n.meta ?? {}) as Record<string, unknown>, ecliOf(source));
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

const keyOfRow = (row: Row, selectedId: string) => {
	if (!row.relation) return null;
	const other = refId(row.ref);
	return row.direction === 'inbound'
		? edgeKey(other, selectedId, row.relation)
		: edgeKey(selectedId, other, row.relation);
};

/** The lid each row of the selected bron names, by the edge it is drawn as: the line says it. */
export function edgeLids(rows: Row[], selectedId: string): Map<string, string> {
	const lids = new Map<string, string>();
	for (const row of rows) {
		const key = keyOfRow(row, selectedId);
		if (key && row.lid && !lids.has(key)) lids.set(key, row.lid);
	}
	return lids;
}

/** The row of the selected bron a canvas edge is drawn for, where the panel has it. */
export const rowOfEdge = (rows: Row[], selectedId: string, edge: GraphEdge): Row | null =>
	rows.find((r) => keyOfRow(r, selectedId) === edgeKey(edge.source, edge.target, edge.relation)) ??
	null;

/**
 * The card of an edge with what its row says of it: the lid, the place and the passage of
 * every mention summed up as the row sums them, and the ends as the row names them. What the
 * edge itself says (its reason, confidence, status) stays the edge's.
 */
export function withRow(v: Verbinding, row: Row, selected: GraphNode): Verbinding {
	const r = verbindingOfRow(row, selected);
	if (!r) return v;
	return {
		...v,
		from: r.from,
		to: r.to,
		lid: r.lid,
		position: r.position ?? v.position,
		at: r.at ?? v.at,
		snippet: r.snippet ?? v.snippet,
		match: r.match ?? v.match,
		noot: r.noot ?? v.noot,
		bereik: r.bereik ?? v.bereik
	};
}

/**
 * The card of a canvas edge where a judgment cites, with what the canvas does not load: of an
 * article, the judgment's row of the article's `cited-by` (the row in Verbonden, so the card
 * names the lid the row names); of a judgment, its passage, from the citing judgment's bucket
 * asked with `edge_meta=passages`. The card as it was otherwise.
 */
export async function kaartMetPassages(
	v: Verbinding,
	source: GraphNode,
	target: GraphNode,
	signal?: AbortSignal
): Promise<Verbinding> {
	if (source.collection !== 'judgments' || v.relation !== 'REFERS_TO') return v;
	if (target.collection === 'articles') return withCitedBy(v, source, target);
	if (v.snippet) return v;
	const r = await getNodeGraph(source.collection, source.key, {
		limit: NODE_BUCKET,
		relations: v.relation,
		nodeTypes: NODE_TYPES[target.collection],
		direction: 'outbound',
		edgeMeta: 'passages',
		signal
	});
	const n = neighborsOf(r).find((x) => x.key === target.key && x.relation === v.relation);
	return n ? metPassages(v, source, n) : v;
}

/**
 * The card of a canvas edge as it opens: with the place the judgment cites where it can be
 * asked, so the card does not grow after it opens (UX-toets #69); as the edge has it where
 * that fails, reported.
 */
export function kaartVanEdge(edge: GraphEdge, source: GraphNode, target: GraphNode) {
	const v = verbindingOfEdge(edge, source, target);
	return kaartMetPassages(v, source, target).catch((e) => {
		report('Verbinding passages', e);
		return v;
	});
}

/** The card of a judgment that cites an article, from its row of the article's `cited-by`:
 *  the passages of the judgment's court only, so its row is on the first page. */
async function withCitedBy(v: Verbinding, source: GraphNode, target: GraphNode) {
	const props = target.raw?.props ?? {};
	const bwb = textOf(props.bwb_id);
	const number = textOf(props.article_number);
	const court = keyEcli(source.key)?.split(':')[2];
	if (!bwb || !number) return v;
	const data = await ifExists(getCitedBy(bwb, number, { limit: CITED_BY_PAGE, court }));
	const row = rowsOfCitedBy(data?.items ?? []).find((r) => r.ref.key === source.key);
	return row ? withRow(v, row, target) : v;
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
