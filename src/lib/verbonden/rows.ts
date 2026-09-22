// A row of the panel Verbonden: one bron, a title and one line of context.
import type { Schema } from '$lib/api/types';
import type { BronRef } from '$lib/bron/href';
import { formatEcliLabel } from '$lib/graph/types';
import { isCollection, type Relation } from '$lib/vocabulary';

export type Neighbor = Schema<'NeighborDTO'>;

export type Row = {
	ref: BronRef;
	title: string;
	context: string | null;
	/** Position inside the bron the row opens at. */
	at?: string | null;
	/** Derived, not read from the source: a heuristic match or a confidence below 1. */
	derived?: boolean;
	/** A change a bill proposes and has not enacted. */
	proposed?: boolean;
	/** The edge the network draws between the selected bron and this one. */
	relation?: Relation;
	direction?: 'inbound' | 'outbound';
};

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ') || null;

export const shortDate = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
		: null;

/** Title and context of a bron, from what a list or node response says about it. */
export function describe(
	collection: string,
	key: string,
	displayName: string | null | undefined,
	props: Record<string, unknown> = {}
): Pick<Row, 'title' | 'context'> {
	const name = text(displayName) ?? key;
	switch (collection) {
		case 'judgments': {
			const ecli = text(props.ecli);
			return {
				title: ecli ? formatEcliLabel(ecli) : name,
				context: join(text(props.court), shortDate(text(props.date))) ?? (ecli ? name : null)
			};
		}
		case 'dossiers':
			return { title: text(props.title) ?? name, context: join(text(props.number) ?? key) };
		case 'documents': {
			// The title of a document is its dossier's; the document itself is its kind and number.
			const number = text(props.sequence != null ? String(props.sequence) : null);
			const kind = text(props.kind);
			return {
				title: kind ? (number ? `${kind}, nr. ${number}` : kind) : name,
				context: join(shortDate(text(props.date)), kind ? null : text(props.title))
			};
		}
		case 'decisions':
			return {
				title: text(props.subject) ?? text(props.title) ?? name,
				context: join(
					props.passed === true ? 'Aangenomen' : props.passed === false ? 'Verworpen' : null,
					shortDate(text(props.date))
				)
			};
		case 'activities':
		case 'commitments':
		case 'cases':
			return {
				title: text(props.agenda_title) ?? text(props.title) ?? text(props.kind) ?? name,
				context: join(text(props.kind), shortDate(text(props.date)))
			};
		case 'members':
			return { title: text(props.name) ?? name, context: text(props.party) };
		case 'committees':
		case 'factions':
			return { title: text(props.name) ?? name, context: text(props.abbreviation) };
		default:
			return { title: name, context: null };
	}
}

export function rowOfNeighbor(n: Neighbor): Row | null {
	if (!isCollection(n.collection)) return null;
	return {
		ref: { collection: n.collection, key: n.key },
		...describe(n.collection, n.key, n.display_name, n.props ?? {}),
		derived: n.confidence != null && n.confidence < 1,
		relation: (n.relation as Relation | null) ?? undefined,
		direction: n.direction === 'inbound' ? 'inbound' : 'outbound'
	};
}
