// One verbinding as an object: the two bronnen with the relation between them, the
// passage with the citation, betrouwbaarheid as a word with its reason, the status and
// the source of the edge. Built from a row of the panel or from an edge of the canvas.
import { refOf, type BronRef } from '$lib/bron/href';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import { relationLabel, statusLabel, type Relation } from '$lib/vocabulary';
import { describe, type Row } from './rows';

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
	confidence: number | null;
	derived: boolean;
	status: 'vastgesteld' | 'voorgesteld';
	/** Why the edge exists, as the pipeline wrote it. */
	reason: string | null;
	edgeId: string | null;
};

const KIND_OF_RELATION: Partial<Record<Relation, string>> = {
	REFERS_TO: 'verwijzing',
	EXPLAINS: 'toelichting',
	AMENDS: 'wijziging',
	INTRODUCES: 'invoeging',
	REPEALS: 'intrekking',
	PART_OF: 'onderdeel',
	BASED_ON: 'grondslag',
	IMPLEMENTS: 'implementatie',
	LEGISLATED_IN: 'behandeling',
	APPEAL_OF: 'hoger beroep'
};

const IN_A: Partial<Record<string, string>> = {
	judgments: 'in een uitspraak',
	documents: 'in een Kamerstuk',
	articles: 'in een artikel',
	instruments: 'in een wet',
	dossiers: 'in een dossier'
};

export function kindOfVerbinding(relation: Relation, sourceCollection: string): string {
	const what = KIND_OF_RELATION[relation] ?? relationLabel(relation);
	if (relation === 'EXPLAINS') return 'toelichting bij een artikel';
	const where = IN_A[sourceCollection];
	return where ? `${what} ${where}` : what;
}

/** `hoog`, `matig` or `laag`, with the reason. */
export function betrouwbaarheid(
	confidence: number | null | undefined,
	derived: boolean,
	reason: string | null
): { word: 'hoog' | 'matig' | 'laag'; why: string } {
	const why =
		reason === 'bwb_article' || reason === 'ecli'
			? 'de verwijzing is als geheel herkend in de tekst'
			: reason
				? `herkend als ${reason.replaceAll('_', ' ')}`
				: derived
					? 'afgeleid uit het dossier of uit de tekst, niet uit een verwijzing'
					: 'gelezen uit de bron';
	if (confidence == null) return { word: derived ? 'matig' : 'hoog', why };
	if (confidence >= 0.9) return { word: 'hoog', why };
	if (confidence >= 0.6) return { word: 'matig', why };
	return { word: 'laag', why };
}

const endOfNode = (node: GraphNode): End => {
	const d = describe(node.collection, node.key, node.label, node.raw?.props ?? {});
	return {
		ref: refOf(node.collection, node.key, node.raw?.props),
		title: node.raw?.display_name ?? d.title,
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
	return {
		from,
		to,
		relation: row.relation,
		label: relationLabel(row.relation, sourceCollection),
		kind: kindOfVerbinding(row.relation, sourceCollection),
		lid: row.lid ?? null,
		position: row.position ?? null,
		at: inbound ? (row.at ?? null) : null,
		snippet: row.snippet ?? null,
		match: row.match ?? null,
		confidence: row.confidence ?? null,
		derived: !!row.derived,
		status: row.proposed ? 'voorgesteld' : 'vastgesteld',
		reason: typeof row.props?.reason === 'string' ? row.props.reason : null,
		edgeId: row.edgeId ?? null
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
	return {
		from: endOfNode(source),
		to: endOfNode(target),
		relation: edge.relation,
		label: relationLabel(edge.relation, source.collection),
		kind: kindOfVerbinding(edge.relation, source.collection),
		lid,
		position: text(meta.paragraph_number) ? `r.o. ${meta.paragraph_number}` : null,
		at: text(meta.paragraph_id),
		snippet: text(meta.snippet),
		match: text(meta.raw_match),
		confidence: edge.confidence ?? null,
		derived: edge.confidence != null && edge.confidence < 1,
		status: statusLabel(edge.status) as 'vastgesteld' | 'voorgesteld',
		reason: text(meta.reason),
		edgeId: edge.id.startsWith('synth:') ? null : (text(meta.edge_id) ?? null)
	};
}

/** `ECLI:NL:HR:2024:1769, r.o. 5.1`: how the source is cited at the position of the verbinding. */
export function citeVerbinding(v: Verbinding): string {
	const parts = [v.from.title, v.position].filter(Boolean);
	return parts.join(', ');
}
