// One verbinding as an object: the two bronnen with the relation between them, the
// passage with the citation, betrouwbaarheid as a word with its reason, the status and
// the source of the edge. Built from a row of the panel.
import { textOf } from '$lib/text/words';
import { refOf, type BronRef } from '$lib/bron/ref';
import type { GraphNode } from '$lib/graph/types';
import { isAmendingRelation, type Relation } from '$lib/vocabulary';
import { HERKOMST_REDEN, kleineLetter } from './hoe';
import { relationLabel, soortVan } from './relation-words';
import { confidenceWord } from './filter';
import { type Row } from './rows';
import { describeBron } from '$lib/bron/describe';
import type { Bereik } from '$lib/text/voetnoten';

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
			? 'de verwijzing staat letterlijk in de tekst'
			: known
				? kleineLetter(known)
				: reason
					? 'staat letterlijk in de tekst'
					: derived
						? 'naam herkend, geen verwijzing met nummer'
						: 'uit de bron';
	return { word: confidenceWord(confidence, derived), why };
}

const endOfNode = (node: GraphNode): End => {
	const d = describeBron(
		node.collection,
		node.key,
		node.raw?.display_name ?? node.label,
		node.raw?.props ?? {},
		node.raw?.cite
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
