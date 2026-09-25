import type { Schema } from '$lib/api/types';
import { bookNumber } from '$lib/text/bw';
import {
	isCollection,
	isRelation,
	nodeId,
	NODE_TYPES,
	type Collection,
	type Relation
} from '$lib/vocabulary';

export type BaseNode = Schema<'BaseNodeDTO'>;

/** What a node is called in the interface. Several collections share one kind. */
export type GraphNodeKind =
	| 'instrument'
	| 'article'
	| 'judgment'
	| 'dossier'
	| 'document'
	| 'activity'
	| 'committee'
	| 'member'
	| 'faction'
	| 'other';

const KIND_OF_COLLECTION: Record<Collection, GraphNodeKind> = {
	instruments: 'instrument',
	instrument_versions: 'other',
	articles: 'article',
	article_versions: 'other',
	annexes: 'other',
	judgments: 'judgment',
	dossiers: 'dossier',
	cases: 'activity',
	documents: 'document',
	activities: 'activity',
	decisions: 'activity',
	commitments: 'activity',
	members: 'member',
	factions: 'faction',
	committees: 'committee',
	// A cabinet is drawn as a body of people, as a committee is.
	cabinets: 'committee'
};

export const kindOfCollection = (collection: Collection): GraphNodeKind =>
	KIND_OF_COLLECTION[collection];

// A version is kept so an article or instrument can be read as it stood at a past
// moment, referring to the matching past version of whatever it cites (VERSION_OF).
// That is a reader concern: the network is about the current text, so a version is
// never drawn as a bron in it, current-focus reader page or not.
const VERSION_COLLECTIONS = new Set<string>(['article_versions', 'instrument_versions']);
export const isVersionCollection = (collection: string): boolean =>
	VERSION_COLLECTIONS.has(collection);

export interface GraphNode {
	id: string;
	collection: Collection;
	key: string;
	kind: GraphNodeKind;
	label: string;
	stub?: boolean;
	/**
	 * A wet drawn only as the end of a change a stuk proposes or makes (AMENDS,
	 * INTRODUCES, REPEALS): its hull with its name around an invisible point, while
	 * none of its articles is on the canvas. A wet is otherwise never a canvas node.
	 */
	anchor?: boolean;
	raw?: BaseNode;
	/** Set by a loader that lays out its nodes; Sigma starts from these. */
	x?: number;
	y?: number;
	size?: number;
}

export type EdgeCategory = 'structural' | 'mutation' | 'semantic';

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	relation: Relation;
	/** Text on the edge when the relation alone does not say enough. */
	label: string;
	directed: true;
	confidence?: number | null;
	/** `voorgesteld` marks a change a bill proposes but has not enacted. */
	status?: string | null;
	/** Evidence the API attaches to an edge (`snippet`, `reason`, ...). */
	meta?: Record<string, unknown> | null;
}

const CATEGORY_OF_RELATION: Record<Relation, EdgeCategory> = {
	PART_OF: 'structural',
	VERSION_OF: 'structural',
	AMENDS: 'mutation',
	INTRODUCES: 'mutation',
	REPEALS: 'mutation',
	BASED_ON: 'structural',
	IMPLEMENTS: 'structural',
	LEGISLATED_IN: 'structural',
	REFERS_TO: 'structural',
	EXPLAINS: 'mutation',
	APPEAL_OF: 'semantic',
	ADVISES_ON: 'semantic',
	SCOPED_BY: 'structural',
	ABOUT: 'structural',
	LED_BY: 'structural',
	MADE_IN: 'structural',
	MEMBER_OF: 'structural',
	AUTHORED: 'mutation',
	VOTED: 'semantic',
	REVISES: 'mutation',
	ACCOMPANIES: 'structural',
	RELATED_TO: 'semantic',
	SECOND_READING_OF: 'mutation',
	SERVED_IN: 'structural'
};

/** Line width of an edge, by relation. */
export const EDGE_WEIGHT: Record<Relation, number> = {
	PART_OF: 0.6,
	VERSION_OF: 0.6,
	AMENDS: 1.0,
	INTRODUCES: 1.0,
	REPEALS: 1.0,
	BASED_ON: 0.8,
	IMPLEMENTS: 0.8,
	LEGISLATED_IN: 0.7,
	REFERS_TO: 0.7,
	EXPLAINS: 0.8,
	APPEAL_OF: 0.6,
	ADVISES_ON: 0.6,
	SCOPED_BY: 0.6,
	ABOUT: 0.7,
	LED_BY: 0.7,
	MADE_IN: 0.7,
	MEMBER_OF: 0.6,
	AUTHORED: 0.8,
	VOTED: 0.6,
	REVISES: 1.0,
	ACCOMPANIES: 0.7,
	RELATED_TO: 0.6,
	SECOND_READING_OF: 1.0,
	SERVED_IN: 0.6
};

/**
 * REFERS_TO between two articles is part of the text of the law (structural).
 * From anything else it is a citation (semantic).
 */
export function edgeCategory(relation: Relation, sourceKind: GraphNodeKind): EdgeCategory {
	return relation === 'REFERS_TO' && sourceKind !== 'article'
		? 'semantic'
		: CATEGORY_OF_RELATION[relation];
}

// ── Judgment court-tier helpers ───────────────────────────────────────────────
// Cassation  — Hoge Raad (HR) and its Parket (PHR): most authoritative
// Appeal     — Gerechtshoven (GH*), Raad van State (RVS), Centrale Raad van Beroep (CRVB),
//              College van Beroep voor het bedrijfsleven (CBB)
// First      — Rechtbanken (RB*)
// Unknown    — anything else (EU, foreign, etc.)
export type JudgmentTier = 'cassation' | 'appeal' | 'first' | 'unknown';

export function judgmentTier(ecli: string | null | undefined): JudgmentTier {
	if (!ecli) return 'unknown';
	// Extract the court-code segment: ECLI:NL:<CODE>:... or ECLI:<CC>:<CODE>:...
	const parts = ecli.replace(/^ECLI:/i, '').split(':');
	// parts[0] = country code (NL, EU, …), parts[1] = court code for NL
	const code = (parts.length >= 3 ? parts[1] : (parts[0] ?? '')).toUpperCase();
	if (code === 'HR' || code === 'PHR') return 'cassation';
	if (code.startsWith('GH') || code === 'RVS' || code === 'CRVB' || code === 'CBB') return 'appeal';
	if (code.startsWith('RB')) return 'first';
	return 'unknown';
}

// Compress verbose court codes to short readable labels for graph nodes.
// "RBNHO 2014/12958" → "Rb 2014/12958"; "GHAMS 2020/3" → "GH 2020/3"
export function shortenCourtCode(code: string): string {
	const u = code.toUpperCase();
	if (u === 'HR' || u === 'PHR') return code; // already short
	if (u === 'RVS') return 'RvS';
	if (u === 'CRVB') return 'CRvB';
	if (u === 'CBB') return 'CBB';
	if (u.startsWith('GH')) return 'GH'; // all Gerechtshoven → "GH"
	if (u.startsWith('RB')) return 'Rb'; // all Rechtbanken → "Rb"
	return code;
}

/**
 * Format an ECLI string into a short, readable label.
 * "ECLI:NL:HR:2023:456"  → "HR 2023/456"
 * "ECLI:EU:C:2020:12"    → "C 2020/12"
 */
export function formatEcliLabel(ecli: string): string {
	const raw = ecli.trim().replace(/^ECLI:/i, '');
	const parts = raw.split(':');
	if (parts.length >= 4 && parts[0] === 'NL') {
		return `${shortenCourtCode(parts[1])} ${parts[2]}/${parts[3]}`;
	}
	if (parts.length >= 4) {
		return `${parts[1]} ${parts[2]}/${parts[3]}`;
	}
	return raw;
}

// Dutch dossier titles are routinely 200+ characters and end with the wet's
// handelsnaam in parentheses — "(Wet verbetering aanpak rijden onder invloed)".
// Use that parenthetical when present; otherwise take a sensible truncation.
export function shortDossierTitle(title: string | null): string | null {
	if (!title) return null;
	const t = title.trim();
	const m = t.match(/\(([^()]+)\)\s*$/);
	if (m && m[1].trim().length > 0) return m[1].trim();
	return t.length > 60 ? t.slice(0, 57).trimEnd() + '…' : t;
}

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * The law of an article or a wet: its BWB id, or the CELEX number of a European one.
 * Every article carries it since API 0.9, each boek of the Burgerlijk Wetboek its own.
 */
export const lawIdOf = (props: Record<string, unknown> | null | undefined): string | null =>
	text(props?.bwb_id) ?? text(props?.celex);

/** What `/api/articles/{law}/{number}` wants for an article. */
/**
 * The law and the address of an article in the article routes: its number, or for an
 * article without one (the Algemene bepaling of the Grondwet) `stam_{stam_id}`, with its
 * heading.
 */
export function articleOf(
	props: Record<string, unknown> | null | undefined
): { lawId: string; articleNumber: string; heading: string | null } | null {
	const lawId = lawIdOf(props);
	const number = text(props?.article_number);
	const stam = text(props?.stam_id);
	const articleNumber = number ?? (stam ? `stam_${stam}` : null);
	return lawId && articleNumber
		? { lawId, articleNumber, heading: number ? null : text(props?.label) }
		: null;
}

/** Lead signatory of a motion or amendment, from `props.actors`. */
function leadSignatory(actors: unknown): { name: string; faction: string | null } | null {
	if (!Array.isArray(actors)) return null;
	const roleOf = (a: Record<string, unknown>) => String(a.role ?? '').toLowerCase();
	const lead =
		actors.find((a) => roleOf(a) === 'eerste indiener') ??
		actors.find((a) => roleOf(a) === 'indiener') ??
		actors[0];
	const name = text(lead?.name);
	return name ? { name, faction: text(lead.faction) } : null;
}

export function buildNodeLabel(node: BaseNode, kind: GraphNodeKind): string {
	const props = node.props ?? {};
	switch (kind) {
		case 'dossier': {
			const number = text(props.label) ?? node.key;
			const title = shortDossierTitle(text(props.title));
			return title ? `${number} · ${title}` : number;
		}
		case 'committee':
		case 'faction':
			return text(props.abbreviation) ?? text(props.name) ?? node.display_name ?? node.key;
		case 'member': {
			const name = text(props.name) ?? node.display_name ?? node.key;
			const party = text(props.party);
			return party ? `${name} (${party})` : name;
		}
		case 'article': {
			const number = bookNumber(text(props.bwb_id), text(props.article_number));
			// An article without a number goes by its heading: "Algemene bepaling".
			return number ? `Art. ${number}` : (text(props.label) ?? node.display_name ?? node.key);
		}
		case 'document':
		case 'activity': {
			const documentKind = text(props.kind);
			if (!documentKind) break;
			const firstWord = documentKind.split(/[\s(]/)[0];
			const lead = /amendement|motie/i.test(documentKind) ? leadSignatory(props.actors) : null;
			if (lead) {
				const lastName = lead.name.split(/\s+/).slice(-1)[0];
				return lead.faction
					? `${firstWord}-${lastName} (${lead.faction})`
					: `${firstWord}-${lastName}`;
			}
			const yearMonth = text(props.date)?.slice(0, 7);
			return yearMonth ? `${yearMonth} · ${firstWord}` : firstWord;
		}
		case 'judgment': {
			const ecli = text(props.ecli) ?? node.display_name;
			return ecli ? formatEcliLabel(ecli) : node.key;
		}
	}
	return node.display_name ?? node.key;
}

function buildGraphNode(node: BaseNode, collection: Collection): GraphNode {
	const kind = kindOfCollection(collection);
	return {
		id: nodeId(collection, node.key),
		collection,
		key: node.key,
		kind,
		label: buildNodeLabel(node, kind),
		stub: node.props?.stub ? true : undefined,
		raw: node
	};
}

/** Null for a node of a collection this app does not know. */
export function nodeToGraphNode(node: BaseNode): GraphNode | null {
	return isCollection(node.collection) ? buildGraphNode(node, node.collection) : null;
}

/** The relation of an API edge, or null when it is not one of the 18. */
export const relationOf = (name: string | null | undefined): Relation | null =>
	isRelation(name) ? name : null;

// ── Nodes built from list and detail responses, without a request to /api/nodes ──

export function syntheticNode(
	collection: Collection,
	key: string,
	displayName: string | null | undefined,
	props: Record<string, unknown>
): GraphNode {
	return buildGraphNode(
		{
			id: nodeId(collection, key),
			key,
			collection,
			type: NODE_TYPES[collection],
			display_name: displayName ?? null,
			labels: [],
			props
		},
		collection
	);
}

export function dossierToGraphNode(d: Schema<'DossierSummaryDTO'>): GraphNode {
	return syntheticNode('dossiers', d.key, d.title ?? d.number, { ...d });
}

export function committeeToGraphNode(c: Schema<'CommitteeDTO'>): GraphNode {
	return syntheticNode('committees', c.key, c.name, { ...c });
}

export function factionToGraphNode(f: Schema<'FactionDTO'>): GraphNode {
	return syntheticNode('factions', f.key, f.abbreviation ?? f.name, { ...f });
}

export function memberToGraphNode(m: Schema<'MemberDTO'>): GraphNode {
	return syntheticNode('members', m.key, m.name, { ...m });
}
