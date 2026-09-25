// A row of the panel Verbonden: one verbinding with one bron. A row is a glyph, a
// title and one meta line: the lid it names, the position in the source, the
// identifier or the date, and the betrouwbaarheid when it is not hoog. The passage
// of the source (`snippet`, with `match` marked) appears when the row is opened.
import { refOf, type BronRef } from '$lib/bron/href';
import { anchorOf, parseQualifier } from '$lib/text/qualifier';
import { withBook } from '$lib/text/bw';
import { isCollection, type Relation } from '$lib/vocabulary';
import { bronKindOf, confidenceWord, type BronKind } from './filter';

export type { Neighbor } from '$lib/api/nodes';
import type { Neighbor } from '$lib/api/nodes';

export type Row = {
	ref: BronRef;
	title: string;
	/** Words about the bron that no other field carries: party, abbreviation, the place in the law. */
	context: string | null;
	kind: BronKind;
	/** Position inside the bron the row opens at: `rov-5.1`, `lid-2`. */
	at?: string | null;
	/** The lid of the selected article the verbinding names: `2`. Null when it names none. */
	lid?: string | null;
	/** Where in the source: `r.o. 5.1`, `§ 3.2`, `artikel I, onderdeel B`. */
	position?: string | null;
	/** ECLI, Kamerstuk number, BWB id. */
	identifier?: string | null;
	/** ISO date of the source. */
	date?: string | null;
	/** The function a lid signed a stuk in, as the source writes it (`minister-president`). */
	function?: string | null;
	/** A seat on a commissie or in a fractie: when it began and ended (open when null), and its role. */
	period?: { from: string | null; to: string | null; role: string | null } | null;
	/** The aard of a reference: `strafverzwaring`, `definitie`. */
	aard?: string | null;
	/** Derived, not read from the source: a heuristic match or a confidence below 1. */
	derived?: boolean;
	/** A change a bill proposes and has not enacted. */
	proposed?: boolean;
	/** The edge the network draws between the selected bron and this one. */
	relation?: Relation;
	direction?: 'inbound' | 'outbound';
	edgeId?: string | null;
	confidence?: number | null;
	/** The passage of the source that carries the verbinding, and the phrase in it. */
	snippet?: string | null;
	match?: string | null;
	/** The court of a judgment. */
	court?: string | null;
	/** Props the canvas needs to draw a bron not on it yet. */
	props?: Record<string, unknown>;
	/** One row per place the bron names the selected one, when there are several. */
	mentions?: Row[];
};

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;

export const shortDate = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
		: null;

export const longDate = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
		: null;

/** The dossier numbers of a node (`37020-XV`), in either chamber. */
export function dossierNumbersOf(props: Record<string, unknown> | null | undefined): string[] {
	const raw = props?.dossier_numbers;
	return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && !!n) : [];
}

/** The name of a court the API gives as a code (`GHAMS`). */
const COURTS: Record<string, string> = {
	HR: 'Hoge Raad',
	PHR: 'Parket bij de Hoge Raad',
	RVS: 'Raad van State',
	CRVB: 'Centrale Raad van Beroep',
	CBB: 'College van Beroep voor het bedrijfsleven',
	GHAMS: 'Gerechtshof Amsterdam',
	GHARL: 'Gerechtshof Arnhem-Leeuwarden',
	GHDHA: 'Gerechtshof Den Haag',
	GHSHE: "Gerechtshof 's-Hertogenbosch",
	RBAMS: 'Rechtbank Amsterdam',
	RBDHA: 'Rechtbank Den Haag',
	RBGEL: 'Rechtbank Gelderland',
	RBLIM: 'Rechtbank Limburg',
	RBMNE: 'Rechtbank Midden-Nederland',
	RBNHO: 'Rechtbank Noord-Holland',
	RBNNE: 'Rechtbank Noord-Nederland',
	RBOBR: 'Rechtbank Oost-Brabant',
	RBOVE: 'Rechtbank Overijssel',
	RBROT: 'Rechtbank Rotterdam',
	RBZWB: 'Rechtbank Zeeland-West-Brabant'
};

export const courtName = (court: string | null): string | null =>
	court ? (COURTS[court.toUpperCase()] ?? court) : null;

/** The name of a document as a title: `Memorie van toelichting, Kamerstuk 36693, nr. 3`. */
function documentTitle(props: Record<string, unknown>, name: string): string {
	const kind = text(props.kind);
	const number = text(props.sequence != null ? String(props.sequence) : null);
	const dossier = dossierNumbersOf(props)[0] ?? null;
	if (!kind) return name;
	const shortKind = kind.replace(/\s*\(.*\)\s*$/, '');
	const stuk = dossier ? `Kamerstuk ${dossier}${number ? `, nr. ${number}` : ''}` : null;
	return stuk ? `${shortKind}, ${stuk}` : number ? `${shortKind}, nr. ${number}` : shortKind;
}

/**
 * Title, context, identifier, date and court of a bron, from what a list or node
 * response says about it.
 */
export function describe(
	collection: string,
	key: string,
	displayName: string | null | undefined,
	props: Record<string, unknown> = {}
): Pick<Row, 'title' | 'context' | 'identifier' | 'date' | 'court'> {
	const name = text(displayName) ?? key;
	const date = text(props.date);
	switch (collection) {
		case 'judgments': {
			const ecli = text(props.ecli);
			const court = courtName(text(props.court) ?? text(props.court_code));
			// The name a judgment is known by: "Hoge Raad, 20 december 2019 (Urgenda)".
			const names = Array.isArray(props.names)
				? props.names.filter((n): n is string => typeof n === 'string')
				: [];
			const known = names.length ? ` (${names.join(', ')})` : '';
			return {
				title: (court ? (join(court, longDate(date)) ?? court) : name) + known,
				context: null,
				identifier: ecli ?? (court ? null : name),
				date,
				court
			};
		}
		case 'dossiers':
			return {
				title: text(props.title) ?? name,
				context: null,
				identifier: text(props.label),
				date
			};
		case 'documents':
			return {
				title: documentTitle(props, name),
				context: text(props.kind) ? null : text(props.title),
				identifier: null,
				date
			};
		case 'decisions':
			return {
				title: text(props.subject) ?? text(props.title) ?? name,
				context: props.passed === true ? 'aangenomen' : props.passed === false ? 'verworpen' : null,
				date
			};
		case 'activities':
		case 'commitments':
		case 'cases':
			return {
				title: text(props.agenda_title) ?? text(props.title) ?? text(props.kind) ?? name,
				context: text(props.kind),
				date
			};
		case 'members':
			return { title: text(props.name) ?? name, context: text(props.party) };
		case 'committees':
		case 'factions':
			return { title: text(props.name) ?? name, context: text(props.abbreviation) };
		case 'instruments':
			return {
				title: text(props.citation_title) ?? text(props.title) ?? name,
				context: null,
				identifier: text(props.bwb_id) ?? text(props.celex)
			};
		// An article of the BW by its book: "Artikel 6:162 BW".
		case 'articles':
			return { title: withBook(name), context: null };
		default:
			return { title: name, context: null };
	}
}

/**
 * The lid a verbinding names, read from the phrase the source used
 * ("artikel 300, tweede lid"). Null when it names none.
 * TODO(backend B7, B8, B12): a lookup once the edge meta carries `lid`.
 */
export function lidOfMatch(match: string | null | undefined): string | null {
	if (!match) return null;
	const q = parseQualifier(match);
	return q?.lid ?? null;
}

/** The anchor a lid and onderdeel name: `lid-2`, `lid-2-onder-a`. */
export const anchorOfMatch = (match: string | null | undefined) =>
	match ? anchorOf(parseQualifier(match)) : null;

/** The aard of a reference as a word: the API's `semantic_type` codes in Dutch. */
const AARD: Record<string, string> = {
	cross_reference: 'verwijzing',
	scope_limitation: 'reikwijdte',
	definition: 'definitie',
	penalty_enhancement: 'strafverzwaring',
	penalty: 'strafbedreiging',
	exception: 'uitzondering',
	procedure: 'procedure',
	application: 'toepassing',
	delegation: 'delegatie',
	condition: 'voorwaarde',
	jurisdiction: 'rechtsmacht',
	limitation: 'verjaring',
	amendment: 'wijziging',
	basis: 'grondslag',
	// The codes of `/api/relationships/types`.
	conditional_requirement: 'voorwaarde',
	definitional_reference: 'definitie',
	delegated_discretion: 'delegatie',
	limiting_exception: 'uitzondering',
	prerequisite_procedure: 'procedure'
	// cross_reference and scope_limitation are named above.
};

export const aardLabel = (code: string | null | undefined): string | null =>
	code ? (AARD[code.toLowerCase()] ?? code.replaceAll('_', ' ')) : null;

export function rowOfNeighbor(n: Neighbor): Row | null {
	if (!isCollection(n.collection)) return null;
	const props = n.props ?? {};
	const meta = (n.meta ?? {}) as Record<string, unknown>;
	const match = text(meta.raw_match) ?? text(meta.qualifier);
	const lid =
		(Array.isArray(meta.leden) && text(meta.leden[0])) ||
		text(meta.lid) ||
		(n.direction === 'inbound' ? lidOfMatch(match) : null);
	return {
		ref: refOf(n.collection, n.key, props),
		...describe(n.collection, n.key, n.display_name, props),
		kind: bronKindOf(n.collection, n.key, props, n.relation),
		lid,
		derived: n.confidence != null && n.confidence < 1,
		proposed: n.status === 'voorgesteld' || undefined,
		relation: (n.relation as Relation | null) ?? undefined,
		direction: n.direction === 'inbound' ? 'inbound' : 'outbound',
		edgeId: n.edge_id ?? null,
		confidence: n.confidence ?? null,
		snippet: text(meta.snippet),
		match,
		period: periodOf(meta),
		function: text(meta.function),
		props
	};
}

/** The seat a MEMBER_OF edge records, from its meta. */
function periodOf(meta: Record<string, unknown>): Row['period'] {
	const from = text(meta.from_date)?.slice(0, 10) ?? null;
	const to = text(meta.to_date)?.slice(0, 10) ?? null;
	return from || to ? { from, to, role: text(meta.role) } : null;
}

/** `2017–2021`, `sinds 2025`, with a role other than plain membership in front. */
export function periodLabel(period: NonNullable<Row['period']>): string {
	const from = period.from?.slice(0, 4);
	const to = period.to?.slice(0, 4);
	const span =
		from && to ? (from === to ? from : `${from}–${to}`) : from ? `sinds ${from}` : `tot ${to}`;
	return period.role && period.role !== 'Lid' ? `${period.role.toLowerCase()}, ${span}` : span;
}

/** `r.o. 2.2.2`, `r.o. 2.2.2 en 2.4.1`, `r.o. 2.2.2, 2.4.1 en 19 meer`. */
export function positionsLabel(positions: string[]): string | null {
	const numbers = positions.map((p) => p.replace(/^r\.o\.\s*/, ''));
	if (numbers.length === 0) return null;
	const prefix = positions[0].startsWith('r.o.') ? 'r.o. ' : '';
	if (numbers.length === 1) return prefix + numbers[0];
	if (numbers.length === 2) return `${prefix}${numbers[0]} en ${numbers[1]}`;
	return `${prefix}${numbers[0]}, ${numbers[1]} en ${numbers.length - 2} meer`;
}

/**
 * The mentions of one bron as one row: the first place it names the selected bron,
 * every place in the meta line, the highest confidence.
 */
export function bundleMentions(mentions: Row[]): Row {
	const [first] = mentions;
	if (mentions.length === 1) return first;
	const positions = [...new Set(mentions.map((m) => m.position).filter((p): p is string => !!p))];
	const confidences = mentions.map((m) => m.confidence).filter((c): c is number => c != null);
	const confidence = confidences.length > 0 ? Math.max(...confidences) : (first.confidence ?? null);
	return {
		...first,
		lid: mentions.find((m) => m.lid)?.lid ?? null,
		position: positionsLabel(positions),
		confidence,
		derived: confidence != null ? confidence < 1 : first.derived,
		mentions
	};
}

/** The rows with every mention as a row of its own, as the table and the export list them. */
export const mentionRows = (rows: Row[]): Row[] => rows.flatMap((r) => r.mentions ?? [r]);

/** The meta line of a row, as separate words; the panel joins them. */
export function metaParts(
	row: Row
): { text: string; kind: 'lid' | 'proposed' | 'derived' | 'plain' }[] {
	const parts: { text: string; kind: 'lid' | 'proposed' | 'derived' | 'plain' }[] = [];
	if (row.lid) parts.push({ text: `lid ${row.lid}`, kind: 'lid' });
	if (row.proposed) parts.push({ text: 'voorgesteld', kind: 'proposed' });
	if (row.aard) parts.push({ text: row.aard, kind: 'plain' });
	// A position that only names the lid (`lid 2`) is said once.
	if (row.position && row.position !== `lid ${row.lid}`)
		parts.push({ text: row.position, kind: 'plain' });
	if (row.context) parts.push({ text: row.context, kind: 'plain' });
	if (row.period) parts.push({ text: periodLabel(row.period), kind: 'plain' });
	// Who signed, as what: the function unless it is the plain seat.
	if (row.function && row.function !== 'Tweede Kamerlid')
		parts.push({ text: `als ${row.function}`, kind: 'plain' });
	const when = row.identifier ?? (row.kind === 'uitspraken' ? null : shortDate(row.date ?? null));
	if (when) parts.push({ text: when, kind: 'plain' });
	const word = confidenceWord(row.confidence, !!row.derived);
	if (word !== 'hoog') parts.push({ text: `betrouwbaarheid ${word}`, kind: 'derived' });
	return parts;
}
