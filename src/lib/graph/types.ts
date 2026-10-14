import { carriesBillTitle, motionOrAmendment, shortKind } from '$lib/text/document-kind';
import { capitalize, textOf, truncate } from '$lib/text/words';
import { eersteIndiener } from '$lib/bron/submitters';
import type { Schema } from '$lib/api/types';
import { menselijkeNaam } from '$lib/bron/menselijk';
import { dossierOwnName, dossierUitProps, officialNumber } from '$lib/bron/dossier-naam';
import { articleName } from '$lib/text/bw';
import { isGeneriek } from '$lib/bron/generiek';
import { maandJaar } from '$lib/text/datum';
import { COLLECTION_ROLE } from './collection-role';
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

export const kindOfCollection = (collection: Collection): GraphNodeKind =>
	COLLECTION_ROLE[collection].kind;

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
	ESTABLISHES: 'mutation',
	AMENDS: 'mutation',
	INTRODUCES: 'mutation',
	REPEALS: 'mutation',
	BASED_ON: 'structural',
	IMPLEMENTS: 'structural',
	LEGISLATED_IN: 'structural',
	PUBLISHED_IN: 'structural',
	REFERS_TO: 'structural',
	EXPLAINS: 'mutation',
	APPEAL_OF: 'semantic',
	ADVISES_ON: 'semantic',
	ANSWERS: 'semantic',
	CONTINUES: 'semantic',
	REFERRED_BY: 'semantic',
	SAME_AS: 'structural',
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
	ESTABLISHES: 1.0,
	AMENDS: 1.0,
	INTRODUCES: 1.0,
	REPEALS: 1.0,
	BASED_ON: 0.8,
	IMPLEMENTS: 0.8,
	LEGISLATED_IN: 0.7,
	PUBLISHED_IN: 0.6,
	REFERS_TO: 0.7,
	EXPLAINS: 0.8,
	APPEAL_OF: 0.6,
	ADVISES_ON: 0.6,
	ANSWERS: 0.6,
	CONTINUES: 0.6,
	REFERRED_BY: 0.6,
	SAME_AS: 0.6,
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
	return truncate(t, 60);
}

/** A name the canvas can carry: at most `max` characters, cut at a word, with "…". */
export const kort = (name: string, max = 40): string => truncate(name, max, { atWord: true });

/**
 * A Kamerstuk on the canvas, short and by what tells it apart in its dossier (API 0.79.6
 * `number`): a paper of the bill by its kind and number ("Voorstel van wet, nr. 2"), a motie or
 * an amendement by its first signatory ("Amendement Verkuijlen, nr. 20"), another paper by its
 * own title where that says more than its kind. The Eerste Kamer numbers with a letter ("C").
 * Without a number, the month. The full name is in the panel and the card.
 */
export function stukLabel(props: Record<string, unknown>): string | null {
	const kind = textOf(props.kind);
	const short = kind ? shortKind(kind) : null;
	const number =
		textOf(props.number) ?? (props.sequence != null ? textOf(String(props.sequence)) : null);
	const nr = number ? (/^\d/.test(number) ? `nr. ${number}` : number) : null;
	const title = textOf(props.title);
	const motie = motionOrAmendment(kind);
	const lead = motie ? leadSignatory(props.actors) : null;
	const indiener = lead
		? `${lead.name.replace(/^(\p{Lu}[\p{L}]?\.\s*)+/u, '')}${lead.faction ? ` (${lead.faction})` : ''}`
		: null;
	const naam = motie
		? [capitalize(motie), indiener].filter(Boolean).join(' ')
		: !carriesBillTitle(kind) && title && !isGeneriek(title, kind)
			? kort(title, 36)
			: (short ?? title);
	if (!naam) return null;
	const waar = nr ?? (textOf(props.date) ? maandJaar(textOf(props.date)) : null);
	return waar ? `${naam}, ${waar}` : naam;
}

/**
 * The law of an article or a wet: its BWB id, or the CELEX number of a European one.
 * Every article carries it since API 0.9, each boek of the Burgerlijk Wetboek its own.
 */
export const lawIdOf = (props: Record<string, unknown> | null | undefined): string | null =>
	textOf(props?.bwb_id) ?? textOf(props?.celex);

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
	const number = textOf(props?.article_number);
	const stam = textOf(props?.stam_id);
	const articleNumber = number ?? (stam ? `stam_${stam}` : null);
	return lawId && articleNumber
		? { lawId, articleNumber, heading: number ? null : textOf(props?.label) }
		: null;
}

/** Lead signatory of a motion or amendment, from `props.actors`. */
function leadSignatory(actors: unknown): { name: string; faction: string | null } | null {
	if (!Array.isArray(actors)) return null;
	const lead = eersteIndiener(actors as Record<string, unknown>[]);
	const name = textOf(lead?.name);
	return name ? { name, faction: textOf(lead?.faction) } : null;
}

export function buildNodeLabel(node: BaseNode, kind: GraphNodeKind): string {
	const props = node.props ?? {};
	// Where the data gives no name, the reader's name of the bron, never its key ($lib/bron/menselijk).
	const mens = () =>
		menselijkeNaam({
			collection: node.collection,
			key: node.key,
			display_name: node.display_name,
			props
		});
	switch (kind) {
		case 'dossier': {
			// By the short title its props carry (API 0.79.54), else its title, cut.
			const number = textOf(props.label) ?? textOf(props.number) ?? mens();
			const naam = dossierOwnName(dossierUitProps(props, number));
			return naam ? `${officialNumber(number)}, ${naam}` : officialNumber(number);
		}
		case 'committee':
		case 'faction':
			return textOf(props.abbreviation) ?? textOf(props.name) ?? mens();
		case 'member': {
			const name = textOf(props.name) ?? mens();
			const party = textOf(props.party);
			return party ? `${name} (${party})` : name;
		}
		case 'article': {
			// "Art. 6:162"; an article of a bijlage by its label, an article without a number by
			// its heading: "Algemene bepaling".
			const name = articleName(
				textOf(props.bwb_id),
				textOf(props.article_number),
				textOf(props.label)
			);
			return name?.replace(/^Artikel /, 'Art. ') ?? mens();
		}
		case 'document': {
			const label = stukLabel(props);
			if (label) return label;
			break;
		}
		case 'activity': {
			const documentKind = textOf(props.kind);
			// An activity of the Eerste Kamer has no kind: its agenda title and day.
			if (!documentKind) return mens();
			const firstWord = documentKind.split(/[\s(]/)[0];
			const lead = /amendement|motie/i.test(documentKind) ? leadSignatory(props.actors) : null;
			if (lead) {
				const lastName = lead.name.split(/\s+/).slice(-1)[0];
				return lead.faction
					? `${firstWord}-${lastName} (${lead.faction})`
					: `${firstWord}-${lastName}`;
			}
			const yearMonth = textOf(props.date)?.slice(0, 7);
			return yearMonth ? `${yearMonth}, ${firstWord}` : firstWord;
		}
		case 'judgment': {
			const ecli = textOf(props.ecli) ?? node.display_name;
			return ecli ? formatEcliLabel(ecli) : mens();
		}
	}
	return mens();
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
			props,
			path: null
		},
		collection
	);
}

/** A member's node from its record: a list's MemberDTO or the detail's MemberDetailDTO. */
export function memberToGraphNode(m: Pick<Schema<'MemberDTO'>, 'key' | 'name'>): GraphNode {
	return syntheticNode('members', m.key, m.name, { ...m });
}
