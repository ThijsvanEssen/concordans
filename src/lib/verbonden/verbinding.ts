// One verbinding as an object: the two bronnen with the relation between them, the
// passage with the citation, betrouwbaarheid as a word with its reason, the status and
// the source of the edge. Built from a row of the panel or from an edge of the canvas.
import { refOf, type BronRef } from '$lib/bron/href';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import { relationLabel, statusLabel, type Relation } from '$lib/vocabulary';
import { paragraphCite } from '$lib/text/judgment-cite';
import { confidenceWord } from './filter';
import { describe, positionsLabel, type Row } from './rows';

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
	APPEAL_OF: 'hoger beroep',
	ADVISES_ON: 'conclusie',
	ANSWERS: 'prejudiciële beslissing',
	CONTINUES: 'vervolg',
	REFERRED_BY: 'verwijzing',
	SAME_AS: 'andere publicatie',
	REVISES: 'begrotingswijziging',
	ACCOMPANIES: 'indiening met een nota',
	RELATED_TO: 'verband tussen zaken',
	SECOND_READING_OF: 'tweede lezing'
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
	if (relation === 'ANSWERS' && sourceCollection === 'documents')
		return 'beantwoording in een brief';
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
		// The place in the citing text: the row's own, or where the selected bron cites it.
		at: row.passageAt ?? (inbound ? (row.at ?? null) : null),
		snippet: row.snippet ?? null,
		match: row.match ?? null,
		confidence: row.confidence ?? null,
		derived: !!row.derived,
		status: row.proposed ? 'voorgesteld' : 'vastgesteld',
		reason: typeof row.props?.reason === 'string' ? row.props.reason : null,
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
		at: id ?? (alle[0] ? `rov-${alle[0]}` : null)
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
		...plaatsVanMeta(meta, source.key),
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
